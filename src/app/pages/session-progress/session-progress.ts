import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-session-progress',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './session-progress.html',
  styleUrls: ['./session-progress.css']
})
export class SessionProgressComponent implements OnInit {
  allSessions: any[] = [];
  
  // Strictly locked to your 6 exact group cards
  classGroups: string[] = [
    '1-2',
    '3-4',
    '5-7 girls',
    '5-7 boys',
    '8-10 girls',
    '8-10 boys'
  ];

  selectedGroup: string | null = null;
  filteredSessions: any[] = [];
  loading: boolean = true;

  // Modal State for Add / Edit
  showAddModal: boolean = false;
  isEditMode: boolean = false;
  editingSessionId: string | null = null;

  newSession = {
    class_group: '1-2',
    session_date: new Date().toISOString().split('T')[0],
    topic: ''
  };
  submitting: boolean = false;

  constructor(
    private supabase: SupabaseService,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
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
      // 1. Fetch from automated session reports table
      const { data: reportSessions, error: err1 } = await this.supabase.client
        .from('sessions')
        .select('*');

      // 2. Fetch from manual entry session progress table
      const { data: manualSessions, error: err2 } = await this.supabase.client
        .from('session_progress')
        .select('*');

      if (err1) console.error('Error fetching reports:', err1.message);
      if (err2) console.error('Error fetching manual sessions:', err2.message);

      // Combine both sources into a single array
      const combined = [
        ...(reportSessions || []),
        ...(manualSessions || [])
      ];

      // Sort by date descending
      this.allSessions = combined.sort((a, b) => 
        new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
      );

      if (this.selectedGroup) {
        this.selectGroup(this.selectedGroup);
      }
    } catch (err) {
      console.error('Unexpected exception during fetch:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  selectGroup(group: string) {
    this.selectedGroup = group;
    // Map records cleanly to the selected card group
    this.filteredSessions = this.allSessions.filter(item => {
      const dbGroup = item.class_group ? item.class_group.trim().toLowerCase() : '';
      return dbGroup.includes(group.toLowerCase());
    });
  }

  openAddModal() {
    this.isEditMode = false;
    this.editingSessionId = null;
    this.newSession = {
      class_group: this.selectedGroup || this.classGroups[0],
      session_date: new Date().toISOString().split('T')[0],
      topic: ''
    };
    this.showAddModal = true;
  }

  openEditModal(session: any, event: Event) {
    event.stopPropagation();
    this.isEditMode = true;
    this.editingSessionId = session.id;
    this.newSession = {
      class_group: session.class_group || this.classGroups[0],
      session_date: session.session_date,
      topic: session.topic || ''
    };
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.editingSessionId = null;
  }

  async saveManualSession() {
    if (!this.newSession.class_group || !this.newSession.topic || !this.newSession.session_date) {
      alert('Please fill in all fields.');
      return;
    }

    this.submitting = true;
    try {
      let error;
      const payload = {
        class_group: this.newSession.class_group.trim(),
        session_date: this.newSession.session_date,
        topic: this.newSession.topic.trim()
      };

      if (this.isEditMode && this.editingSessionId) {
        // Updates target the manual session_progress table
        const res = await this.supabase.client
          .from('session_progress')
          .update(payload)
          .eq('id', this.editingSessionId);
        error = res.error;
      } else {
        // New manual entries save cleanly to session_progress table
        const res = await this.supabase.client
          .from('session_progress')
          .insert([payload]);
        error = res.error;
      }

      if (error) {
        console.error('Error saving session:', error.message);
        alert('Failed to save session: ' + error.message);
      } else {
        this.closeAddModal();
        await this.loadAllSessions();
        if (this.selectedGroup) {
          this.selectGroup(this.selectedGroup);
        }
      }
    } catch (err) {
      console.error('Unexpected error saving session:', err);
    } finally {
      this.submitting = false;
      this.cdr.detectChanges();
    }
  }
}