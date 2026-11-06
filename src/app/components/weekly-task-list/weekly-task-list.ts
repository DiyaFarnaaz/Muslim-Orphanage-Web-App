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

  // Display order; any custom class names go after these
  private readonly groupOrder = [
    'Class 1-4 Below Avg', 'Class 5-9 Below Avg',
    'Class 1-2', 'Class 3', 'Class 4', 'Class 3-4',
    'Class 5-7', 'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-9 Girls', 'Class 8-9 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
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

  // All class names saved in this plan (preset + custom), in a sensible order
  getGroupNames(task: any): string[] {
    const names = new Set<string>();
    ['session_planner', 'session_topic', 'activity_planner', 'activity', 'remarks'].forEach(f =>
      Object.keys(this.parseJSON(task[f])).forEach(k => names.add(k))
    );

    // Old plans saved as "Class 3-4" -> show as Class 3 and Class 4 cards
    if (names.has('Class 3-4') && !names.has('Class 3') && !names.has('Class 4')) {
      names.delete('Class 3-4');
      names.add('Class 3');
      names.add('Class 4');
    }

    const rank = (n: string) => {
      const i = this.groupOrder.indexOf(n);
      return i === -1 ? 999 : i;
    };
    return [...names].sort((a, b) => rank(a) - rank(b));
  }

  getGroupData(taskJson: any, group: string, field?: string) {
    const data = this.parseJSON(taskJson);
    if (data[group]) return data[group];
    if ((group === 'Class 3' || group === 'Class 4') && data['Class 3-4']) {
      return data['Class 3-4'];
    }
    return '-';
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

  async deleteTask(taskId: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this weekly plan?')) {
      try {
        const { error } = await this.supabase.client
          .from('weekly_tasks')
          .delete()
          .eq('id', taskId);

        if (error) throw error;

        alert('Weekly plan deleted successfully!');
        if (this.selectedTask?.id === taskId) {
          this.selectedTask = null;
        }
        await this.loadWeeklyTasks();
      } catch (err: any) {
        console.error('Error deleting weekly plan:', err);
        alert('Could not delete weekly plan: ' + (err.message || err));
      }
    }
  }

  getKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}