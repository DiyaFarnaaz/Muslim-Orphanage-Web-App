import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../services/supabase';
import { VideoCallStateService } from '../../services/video-call-state';

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
  public isLoaded: boolean = true;

  public meetings: MeetingModel[] = [];
  public currentLiveAttendees: string[] = [];

  public showScheduleForm: boolean = false;
  public isEditing: boolean = false;
  public editingMeetingId: string | null = null;
  public tempTitle: string = '';
  public tempTime: string = '';

  public chatInput: string = '';

  private statusCheckInterval: any;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public callState: VideoCallStateService
  ) {
    // Jitsi events (incoming chat messages, mute toggles) can arrive outside
    // a normal Angular event handler, so make sure the view updates.
    this.callState.onStateChanged = () => this.cdRef.detectChanges();
  }

  // The template compares `activeMeetingId === meeting.id` to decide whether to
  // show the live call layout. That's a real property lookup on THIS component,
  // so it must exist here - it can't reach into callState on its own.
  public get activeMeetingId(): string | null {
    return this.callState.activeMeetingId;
  }

  async ngOnInit(): Promise<void> {
    await this.loadUserProfileAsync();
    await this.fetchMeetings();

    // Let the PiP mini "expand" button bring the user back to this page from
    // anywhere in the app, even if this component isn't currently mounted.
    this.callState.onRequestExpand = () => {
      this.router.navigate(['/video-call']).then(() => {
        setTimeout(() => this.callState.expandToFullScreen(), 50);
      });
    };

    // IMPORTANT: this runs AFTER fetchMeetings() has resolved, so `this.meetings`
    // is actually populated. Doing this in ngAfterViewInit was the bug - that
    // hook fires before this async function reaches this point, so the lookup
    // below always found nothing and the live call never got re-expanded.
    const savedActiveMeetingId = sessionStorage.getItem('active_meeting_id') || this.callState.activeMeetingId;
    if (savedActiveMeetingId) {
      const targetMeeting = this.meetings.find(m => m.id === savedActiveMeetingId);
      if (targetMeeting && targetMeeting.is_active) {
        this.callState.activeMeetingId = targetMeeting.id;
        targetMeeting.isExpanded = true;
        console.log('[VideoCallComponent] restoring active call on return to page', targetMeeting.room_name);
        this.callState.initializeMeeting(targetMeeting.room_name, this.userEmail, this.userName);
      } else {
        sessionStorage.removeItem('active_meeting_id');
        this.callState.disposeMeeting();
      }
    } else if (this.callState['globalContainer']) {
      (this.callState['globalContainer'] as HTMLElement).style.display = 'none';
    }

    this.statusCheckInterval = setInterval(async () => {
      if (!this.callState.activeMeetingId) {
        await this.fetchMeetings();
      }
    }, 2000);
  }

  public async goBack(): Promise<void> {
    if (this.callState.activeMeetingId) {
      // This is a genuine click, so it's allowed to request real OS-level PiP.
      // Falls back to the in-page floating card if the browser can't do real PiP.
      await this.callState.minimizeToPiP(true);
    }
    this.router.navigate(['/dashboard']);
  }

  // Wire this to a "pop out" button anywhere in your template while a call is
  // live. Real Picture-in-Picture MUST be requested from a direct click like
  // this one — it cannot be requested later from ngOnDestroy/router events.
  public async popOutToPiP(): Promise<void> {
    await this.callState.minimizeToPiP(true);
  }

  public sendChat(): void {
    if (!this.chatInput.trim()) return;
    this.callState.sendChatMessage(this.chatInput);
    this.chatInput = '';
  }

  private async loadUserProfileAsync(): Promise<void> {
    try {
      const user = await this.supabaseService.getCurrentUser();
      if (user && user.email) {
        this.userEmail = user.email;
        this.userName = user.email.split('@')[0]; 
        
        let role = '';
        const client = (this.supabaseService as any).supabase;
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
      const client = (this.supabaseService as any).supabase;
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

          if (this.callState.activeMeetingId) {
            const currentActiveModel = this.meetings.find(m => m.id === this.callState.activeMeetingId);
            if (currentActiveModel && !currentActiveModel.is_active) {
              this.callState.disposeMeeting();
            }
          }

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
      const client = (this.supabaseService as any).supabase;
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
      const client = (this.supabaseService as any).supabase;
      if (client) {
        await client.from('video_meetings').delete().eq('id', meeting.id);
        await this.fetchMeetings();
      }
    }
  }

  public async startMeeting(meeting: MeetingModel): Promise<void> {
    if (!this.isAdmin) return;
    const client = (this.supabaseService as any).supabase;
    if (client) {
      await client.from('video_meetings').update({ is_active: true, updated_at: new Date() }).eq('id', meeting.id);
      meeting.is_active = true;
    }
    this.callState.activeMeetingId = meeting.id;
    sessionStorage.setItem('active_meeting_id', meeting.id);
    meeting.isExpanded = true;
    
    this.callState.initializeMeeting(meeting.room_name, this.userEmail, this.userName);
  }

  public joinMeeting(meeting: MeetingModel): void {
    if (!meeting.is_active) return;
    this.callState.activeMeetingId = meeting.id;
    sessionStorage.setItem('active_meeting_id', meeting.id);
    meeting.isExpanded = true;

    this.callState.initializeMeeting(meeting.room_name, this.userEmail, this.userName);
  }

  public async handleMeetingClose(meeting: MeetingModel): Promise<void> {
    let sessionParticipants = this.currentLiveAttendees.length > 0 
      ? this.currentLiveAttendees 
      : [this.userName || this.userEmail.split('@')[0]];

    const cleanedParticipants = Array.from(new Set(sessionParticipants.map(p => {
      if (p.includes('@')) return p.split('@')[0];
      return p.trim();
    }).filter(Boolean)));

    const updatedPast = Array.from(new Set([...(meeting.past_attendees || []), ...cleanedParticipants]));

    const client = (this.supabaseService as any).supabase;
    if (client && this.isAdmin) {
      await client
        .from('video_meetings')
        .update({ is_active: false, past_attendees: updatedPast, updated_at: new Date() })
        .eq('id', meeting.id);
    }

    this.callState.disposeMeeting();
    this.currentLiveAttendees = [];
    meeting.is_active = false;
    meeting.past_attendees = updatedPast;
    meeting.isExpanded = true;

    await this.fetchMeetings();
  }

  ngOnDestroy(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
    }
    // If routing away while a meeting is active, drop into the in-page floating
    // card. This does NOT attempt real OS-level PiP: ngOnDestroy has no user
    // gesture behind it, so that request would just be rejected by the browser.
    // Real out-of-tab PiP instead auto-triggers from the service's own
    // visibilitychange listener when you actually switch tabs/apps, or from
    // goBack()/popOutToPiP() when the user clicks something directly.
    if (this.callState.activeMeetingId && !this.callState.isMinimized) {
      console.log('[VideoCallComponent] ngOnDestroy: dropping active call into in-page floating card');
      this.callState.minimizeToPiP(false);
    }
  }
}