import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
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
  classGroups = ['1-4', '5-7', '8-10'];

  constructor(
    private supabase: SupabaseService, 
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}

  async ngOnInit() {
    await this.loadMeetings();
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

  // Safely parse JSON text stored in columns back into objects for display
  parseJSON(value: any) {
    try {
      return typeof value === 'string' ? JSON.parse(value) : (value || {});
    } catch {
      return {};
    }
  }

  goBack() {
    this.location.back();
  }

  onSelectMeeting(meeting: any): void {
    this.selectedMeeting = meeting;
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}