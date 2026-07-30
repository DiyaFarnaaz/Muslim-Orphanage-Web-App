import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../services/supabase';
import { MeetingService } from '../../services/meeting';

interface MeetingModel {
  id: string;
  room_name: string;
  meeting_title: string;
  scheduled_time: string;
  is_active: boolean;
  past_attendees: string[];
  isExpanded?: boolean;
}

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './video-call.html',
  styleUrls: ['./video-call.css']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  public userEmail: string = '';
  public userName: string = 'User';
  public isAdmin: boolean = false;

  public meetings: MeetingModel[] = [];

  public showScheduleForm: boolean = false;
  public isEditing: boolean = false;
  public editingMeetingId: string | null = null;
  public tempTitle: string = '';
  public tempTime: string = '';

  private statusCheckInterval: any;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public meeting: MeetingService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadUserProfileAsync();
    await this.fetchMeetings();

    // Check if URL has a room query param to auto-join if active
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoom = urlParams.get('room');
    if (targetRoom) {
      const found = this.meetings.find(m => m.room_name === targetRoom);
      if (found && found.is_active) {
        this.joinMeeting(found);
      }
    }

    this.statusCheckInterval = setInterval(async () => {
      if (!this.meeting.activeMeetingId()) {
        await this.fetchMeetings();
      }
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
  }

  public goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  public getShareableLink(roomName: string): string {
    const origin = window.location.origin;
    return `${origin}/dashboard/video-call?room=${roomName}`;
  }

  public copyMeetingLink(roomName: string): void {
    const link = this.getShareableLink(roomName);
    navigator.clipboard.writeText(link).then(() => {
      alert('Meeting link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy link: ', err);
    });
  }

  private async loadUserProfileAsync(): Promise<void> {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user && user.email) {
        this.userEmail = user.email;
        this.userName = user.email.split('@')[0];

        let role = '';
        const client = this.supabaseService.client;
        if (client) {
          const { data: profileData, error } = await client
            .from('profiles')
            .select('role')
            .eq('email', user.email)
            .single();

          if (profileData && !error) {
            role = profileData.role;
          }
        }

        const metadataRole = user.user_metadata?.['role'] || user.app_metadata?.['role'];
        const resolvedRole = role || metadataRole || '';

        this.isAdmin = resolvedRole.toLowerCase() === 'admin' ||
                       user.email === 'admin@orphanage.com' ||
                       user.email.toLowerCase().includes('admin') ||
                       user.email.toLowerCase() === 'diyafamaaz@gmail.com';

        this.cdRef.detectChanges();
      }
    } catch (error) {
      console.warn('Error loading user profile role:', error);
    }
  }

  private async fetchMeetings(): Promise<void> {
    try {
      const client = this.supabaseService.client;
      if (client) {
        const { data, error } = await client
          .from('video_meetings')
          .select('*')
          .order('updated_at', { ascending: false });

        if (data && !error) {
          this.meetings = data.map((m: any) => {
            const existing = this.meetings.find(x => x.id === m.id);
            return {
              ...m,
              isExpanded: existing ? existing.isExpanded : false
            };
          });
          this.cdRef.detectChanges();
        }
      }
    } catch (err) {
      console.debug('Meeting fetch skipped:', err);
    }
  }

  public toggleCardExpansion(meeting: MeetingModel): void {
    meeting.isExpanded = !meeting.isExpanded;
  }

  public meetingHasEnded(meeting: MeetingModel): boolean {
    return !meeting.is_active && (meeting.past_attendees?.length ?? 0) > 0;
  }

  public openScheduleModal(): void {
    if (!this.isAdmin) return;
    this.isEditing = false;
    this.editingMeetingId = null;
    this.tempTitle = '';
    this.tempTime = '';
    this.showScheduleForm = true;
  }

  public openEditModal(meeting: MeetingModel): void {
    if (!this.isAdmin) return;
    this.isEditing = true;
    this.editingMeetingId = meeting.id;
    this.tempTitle = meeting.meeting_title ? String(meeting.meeting_title) : '';
    this.tempTime = '';
    this.showScheduleForm = true;
  }

  public closeScheduleModal(): void {
    this.showScheduleForm = false;
    this.tempTitle = '';
    this.tempTime = '';
    this.isEditing = false;
    this.editingMeetingId = null;
  }

  public async saveMeeting(inputTitle: string, inputTime: string): Promise<void> {
    if (!this.isAdmin) return;
    if (!inputTitle || !inputTitle.trim()) {
      alert('Please enter a valid meeting title.');
      return;
    }

    let formattedTime = 'Not Scheduled Yet';
    if (inputTime) {
      formattedTime = new Date(inputTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    }

    try {
      const client = this.supabaseService.client;
      if (!client) return;

      if (this.isEditing && this.editingMeetingId) {
        await client.from('video_meetings').update({
          meeting_title: inputTitle.trim(),
          scheduled_time: formattedTime,
          updated_at: new Date()
        }).eq('id', this.editingMeetingId);
      } else {
        const uniqueRoom = 'OrphanageRoom_' + Math.random().toString(36).substring(2, 8);
        await client.from('video_meetings').insert([{
          room_name: uniqueRoom,
          meeting_title: inputTitle.trim(),
          scheduled_time: formattedTime,
          is_active: false,
          past_attendees: []
        }]);
      }

      this.closeScheduleModal();
      await this.fetchMeetings();
    } catch (err: any) {
      console.error('Error saving meeting:', err);
    }
  }

  public async deleteMeeting(meeting: MeetingModel): Promise<void> {
    if (!this.isAdmin) return;
    if (confirm(`Are you sure you want to delete "${meeting.meeting_title}"?`)) {
      const client = this.supabaseService.client;
      if (client) {
        await client.from('video_meetings').delete().eq('id', meeting.id);
        await this.fetchMeetings();
      }
    }
  }

  public async startMeeting(meeting: MeetingModel): Promise<void> {
    if (!this.isAdmin) return;
    const client = this.supabaseService.client;
    if (client) {
      await client.from('video_meetings').update({ is_active: true, updated_at: new Date() }).eq('id', meeting.id);
      meeting.is_active = true;
    }
    this.meeting.join(meeting.room_name, this.userEmail, this.userName, meeting.id, this.isAdmin);
  }

  public joinMeeting(meeting: MeetingModel): void {
    if (!meeting.is_active) return;
    this.meeting.join(meeting.room_name, this.userEmail, this.userName, meeting.id, this.isAdmin);
  }
}