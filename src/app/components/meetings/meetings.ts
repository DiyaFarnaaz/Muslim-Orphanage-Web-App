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

  // Display order; any custom class names go after these
  private readonly groupOrder = [
    'Class 1-4 Below Avg', 'Class 5-9 Below Avg',
    'Class 1-2', 'Class 3', 'Class 4', 'Class 3-4',
    'Class 5-7', 'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-9 Girls', 'Class 8-9 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
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

  // All class names saved in this meeting (preset + custom), sorted
  getGroupNames(meeting: any): string[] {
    const names = new Set<string>();
    ['session_lead', 'session_topic', 'activity', 'gifts', 'props', 'remarks'].forEach(f =>
      Object.keys(this.parseJSON(meeting[f])).forEach(k => names.add(k))
    );
    const rank = (n: string) => {
      const i = this.groupOrder.indexOf(n);
      return i === -1 ? 999 : i;
    };
    return [...names].sort((a, b) => rank(a) - rank(b));
  }

  getGroupData(jsonField: any, group: string): string {
    const data = this.parseJSON(jsonField);
    if (data[group]) {
      return data[group];
    }
    // Fallback to legacy 'Class 3-4' if specific Class 3 or 4 data is missing
    if ((group === 'Class 3' || group === 'Class 4') && data['Class 3-4']) {
      return data['Class 3-4'];
    }
    return '-';
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

  async deleteMeeting(meetingId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this session plan?')) {
      try {
        const { error } = await this.supabase.client
          .from('meetings')
          .delete()
          .eq('id', meetingId);

        if (error) throw error;

        alert('Session plan deleted successfully!');
        if (this.selectedMeeting?.id === meetingId) {
          this.selectedMeeting = null;
        }
        await this.loadMeetings();
      } catch (err: any) {
        console.error('Error deleting session plan:', err);
        alert('Could not delete session plan: ' + (err.message || err));
      }
    }
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}