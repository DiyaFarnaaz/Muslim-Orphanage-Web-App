import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
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
    private location: Location,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadReports();
  }

  async loadReports() {
    try {
      const { data, error } = await this.supabase.client
        .from('sessions')
        .select('id, session_lead_name, class_group, activity, topic, winner, feedback, doc_url, media_url, session_date')
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error);
        return;
      }

      const formattedData = (data || []).map((report: any) => ({
        ...report,
        doc_urls: report.doc_url ? report.doc_url.split(',').filter((url: string) => url.trim() !== '') : [],
        media_urls: report.media_url ? report.media_url.split(',').filter((url: string) => url.trim() !== '') : []
      }));

      this.groupedReports = formattedData.reduce((acc: any, report: any) => {
        const date = report.session_date;
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

  editEvent(eventId: string, event: Event) {
    event.stopPropagation(); // Prevents expanding/collapsing the accordion card
    this.router.navigate(['/session-report'], { queryParams: { id: eventId } });
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}