import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterModule],
  templateUrl: './events.html',
  styleUrls: ['./events.css']
})
export class EventsComponent implements OnInit {
  groupedReports: { [date: string]: any[] } = {};
  selectedEvent: any = null;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadReports();
  }

  async loadReports() {
    try {
      const { data, error } = await this.supabase.client
        .from('sessions')
        .select('id, session_lead_name, class_group, activity, topic, winner, feedback, session_date')
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error);
        return;
      }

      console.log('Fetched sessions data:', data);

      this.groupedReports = (data || []).reduce((acc: any, report: any) => {
        const date = report.session_date ? report.session_date.split('T')[0] : 'Unscheduled';
        if (!acc[date]) acc[date] = [];
        acc[date].push(report);
        return acc;
      }, {});

      this.cdr.detectChanges();
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  onSelectEvent(event: any): void {
    this.selectedEvent = event;
  }

  editEvent(eventId: string, event: MouseEvent) {
    event.stopPropagation(); // Prevents expanding/collapsing the accordion card
    this.router.navigate(['/session-report'], { queryParams: { id: eventId } });
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}