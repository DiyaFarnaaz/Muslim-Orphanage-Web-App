import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-meetings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './meetings.html',
  styleUrls: ['./meetings.css']
})
export class MeetingsComponent implements OnInit {
  groupedMeetings: { [date: string]: any[] } = {};
  selectedMeeting: any = null;
  
  classGroups = [
    'Class 1-2', 
    'Class 3-4', 
    'Class 5-7 Girls', 
    'Class 5-7 Boys', 
    'Class 8-10 Girls', 
    'Class 8-10 Boys'
  ];

  isAdmin: boolean = false;

  constructor(
    private supabase: SupabaseService, 
    private cdr: ChangeDetectorRef,
    private location: Location,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.checkAdminStatus();
    await this.loadMeetings();
  }

  async checkAdminStatus() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (!user) return;

      const { data: profile } = await this.supabase.client
        .from('profiles')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

      if (profile && (profile.is_admin || profile.role === 'admin')) {
        this.isAdmin = true;
      }
    } catch (err) {
      console.error('Error verifying admin status:', err);
    }
  }

  async loadMeetings() {
    const { data, error } = await this.supabase.client
      .from('meetings')
      .select('*')
      .order('meeting_date', { ascending: false });

    if (error) {
      console.error('Supabase Error:', error);
    } else {
      this.groupedMeetings = (data || []).reduce((acc: any, m: any) => {
        const date = m.meeting_date || 'Upcoming';
        if (!acc[date]) acc[date] = [];
        acc[date].push(m);
        return acc;
      }, {});
      this.cdr.detectChanges();
    }
  }

  parseJSON(value: any) {
    try {
      return typeof value === 'string' ? JSON.parse(value) : (value || {});
    } catch {
      return {};
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']); 
  }

  onSelectMeeting(meeting: any): void {
    this.selectedMeeting = meeting;
  }

  editMeeting(meetingId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/add-meeting', meetingId]);
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}