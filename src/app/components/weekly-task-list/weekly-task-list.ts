import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-weekly-task-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './weekly-task-list.html',
  styleUrls: ['./weekly-task-list.css']
})
export class WeeklyTaskListComponent implements OnInit {
  groupedTasks: { [date: string]: any[] } = {};
  selectedTask: any = null;
  loading = true;
  isAdmin = false;

  gradeGroups = [
    'Class 1-2', 
    'Class 3-4', 
    'Class 5-7 Girls', 
    'Class 5-7 Boys', 
    'Class 8-10 Girls', 
    'Class 8-10 Boys'
  ];

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.checkAdminStatus();
    await this.loadWeeklyTasks();
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

  async loadWeeklyTasks() {
    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('weekly_tasks')
        .select('*')
        .order('week_date_range', { ascending: false });

      if (error) {
        console.error('Supabase Error:', error);
      } else {
        this.groupedTasks = (data || []).reduce((acc: any, t: any) => {
          const date = t.week_date_range || 'Upcoming';
          if (!acc[date]) acc[date] = [];
          acc[date].push(t);
          return acc;
        }, {});
      }
    } catch (err) {
      console.error('Failed to load weekly tasks', err);
    } finally {
      this.loading = false;
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

  onSelectTask(task: any): void {
    this.selectedTask = task;
  }

  editTask(taskId: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/weekly-tasks/edit', taskId]);
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}