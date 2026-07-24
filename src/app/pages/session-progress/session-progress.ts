import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-session-progress',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './session-progress.html',
  styleUrls: ['./session-progress.css']
})
export class SessionProgressComponent implements OnInit {
  allSessions: any[] = [];
  classGroups: string[] = [];
  selectedGroup: string | null = null;
  filteredSessions: any[] = [];
  loading: boolean = true;

  constructor(
    private supabase: SupabaseService,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    console.log('SessionProgressComponent initialized. Fetching sessions...');
    await this.loadAllSessions();
  }

  goBack() {
    if (this.selectedGroup) {
      this.selectedGroup = null;
    } else {
      this.location.back();
    }
  }

  async loadAllSessions() {
    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('sessions')
        .select('session_date, topic, class_group')
        .order('session_date', { ascending: false });

      if (error) {
        console.error('Supabase Error fetching sessions:', error.message);
      } else {
        console.log('Raw data received from Supabase:', data);
        this.allSessions = data || [];
        
        // Extract and map group names
        const groups = this.allSessions.map(item => {
          return item.class_group ? item.class_group.trim() : 'General';
        });

        this.classGroups = Array.from(new Set(groups)).sort();
        console.log('Processed Unique Class Groups:', this.classGroups);
      }
    } catch (err) {
      console.error('Unexpected exception during fetch:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  selectGroup(group: string) {
    console.log('Selected Group:', group);
    this.selectedGroup = group;
    this.filteredSessions = this.allSessions.filter(
      item => (item.class_group ? item.class_group.trim() : 'General') === group
    );
    console.log('Filtered sessions for this group:', this.filteredSessions);
  }
}