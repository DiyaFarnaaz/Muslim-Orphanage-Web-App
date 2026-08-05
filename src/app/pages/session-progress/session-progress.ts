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
  filteredFuturePlans: any[] = [];
  loading: boolean = true;
  
  // Strict admin role verification flags
  checkingRole: boolean = true;
  isAdmin: boolean = false;

  // Session Modal State
  showAddModal: boolean = false;
  isEditMode: boolean = false;
  editingSessionId: string | null = null;

  newSession = {
    class_group: '1-2',
    session_date: new Date().toISOString().split('T')[0],
    topic: ''
  };

  // Dedicated Future Session Plans Modal State
  showFuturePlansModal: boolean = false;
  isFuturePlanEditMode: boolean = false;
  editingFuturePlanId: string | null = null;

  newFuturePlan = {
    class_group: '1-2',
    plan_text: ''
  };

  submitting: boolean = false;
  savingFuturePlan: boolean = false;

  constructor(
    private supabase: SupabaseService,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.checkUserRole();
    await this.loadAllSessions();
  }

async checkUserRole() {
  this.checkingRole = true;
  this.isAdmin = false; 

  try {
    const { data: { user }, error: authError } = await this.supabase.client.auth.getUser();
    if (authError || !user) {
      this.isAdmin = false;
      return;
    }

    // Rely ONLY on the profiles database table
    const { data: profile, error: profileError } = await this.supabase.client
      .from('profiles')
      .select('is_admin, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && (profile.is_admin === true || profile.role === 'admin')) {
      this.isAdmin = true;
    } else {
      this.isAdmin = false;
    }
  } catch (err) {
    console.error('Error checking role:', err);
    this.isAdmin = false;
  } finally {
    this.checkingRole = false;
    this.cdr.detectChanges();
  }
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
      const { data: reportSessions } = await this.supabase.client.from('sessions').select('*');
      const { data: manualSessions } = await this.supabase.client.from('session_progress').select('*');

      const combined = [...(reportSessions || []), ...(manualSessions || [])];

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
    
    this.filteredSessions = this.allSessions.filter(item => {
      const dbGroup = item.class_group ? item.class_group.trim().toLowerCase() : '';
      return dbGroup.includes(group.toLowerCase()) && item.topic && item.topic !== 'Future Plan Entry';
    });

    this.filteredFuturePlans = this.allSessions.filter(item => {
      const dbGroup = item.class_group ? item.class_group.trim().toLowerCase() : '';
      return dbGroup.includes(group.toLowerCase()) && item.future_plans && item.future_plans.trim() !== '';
    });
  }

  openAddModal() {
    if (!this.isAdmin) return;
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
    if (!this.isAdmin) return;
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
    if (!this.isAdmin) return;
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
        const res = await this.supabase.client.from('session_progress').update(payload).eq('id', this.editingSessionId);
        error = res.error;
      } else {
        const res = await this.supabase.client.from('session_progress').insert([payload]);
        error = res.error;
      }

      if (error) {
        alert('Failed to save session: ' + error.message);
      } else {
        this.closeAddModal();
        await this.loadAllSessions();
        if (this.selectedGroup) this.selectGroup(this.selectedGroup);
      }
    } finally {
      this.submitting = false;
      this.cdr.detectChanges();
    }
  }

  openFuturePlansModal() {
    if (!this.isAdmin) return;
    this.isFuturePlanEditMode = false;
    this.editingFuturePlanId = null;
    this.newFuturePlan = {
      class_group: this.selectedGroup || this.classGroups[0],
      plan_text: ''
    };
    this.showFuturePlansModal = true;
  }

  openEditFuturePlanModal(planItem: any, event: Event) {
    event.stopPropagation();
    if (!this.isAdmin) return;
    this.isFuturePlanEditMode = true;
    this.editingFuturePlanId = planItem.id;
    this.newFuturePlan = {
      class_group: planItem.class_group || this.classGroups[0],
      plan_text: planItem.future_plans || ''
    };
    this.showFuturePlansModal = true;
  }

  closeFuturePlansModal() {
    this.showFuturePlansModal = false;
    this.editingFuturePlanId = null;
  }

  async saveFuturePlan() {
    if (!this.isAdmin) return;
    if (!this.newFuturePlan.class_group || !this.newFuturePlan.plan_text) {
      alert('Please select a class group and write a future session plan.');
      return;
    }

    this.savingFuturePlan = true;
    try {
      let error;
      const payload = {
        class_group: this.newFuturePlan.class_group.trim(),
        session_date: new Date().toISOString().split('T')[0],
        topic: 'Future Plan Entry',
        future_plans: this.newFuturePlan.plan_text.trim()
      };

      if (this.isFuturePlanEditMode && this.editingFuturePlanId) {
        const res = await this.supabase.client
          .from('session_progress')
          .update({ future_plans: this.newFuturePlan.plan_text.trim(), class_group: this.newFuturePlan.class_group.trim() })
          .eq('id', this.editingFuturePlanId);
        error = res.error;
      } else {
        const res = await this.supabase.client
          .from('session_progress')
          .insert([payload]);
        error = res.error;
      }

      if (error) {
        alert('Failed to save future session plan: ' + error.message);
      } else {
        this.closeFuturePlansModal();
        await this.loadAllSessions();
        if (this.selectedGroup) this.selectGroup(this.selectedGroup);
      }
    } finally {
      this.savingFuturePlan = false;
      this.cdr.detectChanges();
    }
  }

  async deleteFuturePlan(planId: string, event: Event) {
    event.stopPropagation();
    if (!this.isAdmin) return;
    if (!confirm('Are you sure you want to delete this future session plan?')) return;

    try {
      const { error } = await this.supabase.client
        .from('session_progress')
        .delete()
        .eq('id', planId);

      if (error) {
        alert('Failed to delete from database: ' + error.message);
      } else {
        await this.loadAllSessions();
        if (this.selectedGroup) this.selectGroup(this.selectedGroup);
      }
    } catch (err) {
      console.error('Error deleting future session plan:', err);
    }
  }
}