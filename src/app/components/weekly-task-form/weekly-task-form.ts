import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-weekly-task-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './weekly-task-form.html',
  styleUrls: ['./weekly-task-form.css']
})
export class WeeklyTaskFormComponent implements OnInit {
  isEditMode = false;
  isSubmitting = false;
  taskId: string | null = null;

  weeklyTask = {
    startDate: '',
    endDate: '',
    giftPlanner: '',
    props: '',          // Moved props down here
    additionalTask: ''
  };
  
  classGroups = [
    'Class 1-2', 
    'Class 3-4', 
    'Class 5-7 Girls', 
    'Class 5-7 Boys', 
    'Class 8-10 Girls', 
    'Class 8-10 Boys'
  ];

  // Removed props from class group data map
  tasksData: { [key: string]: { session_planner: string, session_topic: string, activity_planner: string, activity: string, remarks: string } } = {};

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {
    this.classGroups.forEach(group => {
      this.tasksData[group] = {
        session_planner: '',
        session_topic: '',
        activity_planner: '',
        activity: '',
        remarks: ''
      };
    });
  }

  async ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id');
    if (this.taskId) {
      this.isEditMode = true;
      await this.loadTaskData(this.taskId);
    }
  }

  async loadTaskData(id: string) {
    try {
      const { data, error } = await this.supabase.client
        .from('weekly_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error loading task:', error);
      } else if (data) {
        if (data.week_date_range) {
          const parts = data.week_date_range.split(' to ');
          this.weeklyTask.startDate = parts[0] || '';
          this.weeklyTask.endDate = parts[1] || '';
        }

        this.weeklyTask.giftPlanner = data.gift_planner || '';
        this.weeklyTask.props = data.props || ''; // Load shared props
        this.weeklyTask.additionalTask = data.additional_task || '';

        const parseField = (fieldData: any) => {
          if (!fieldData) return {};
          return typeof fieldData === 'string' ? JSON.parse(fieldData) : fieldData;
        };

        const planners = parseField(data.session_planner);
        const topics = parseField(data.session_topic);
        const activityPlanners = parseField(data.activity_planner);
        const activities = parseField(data.activity);
        const remarksData = parseField(data.remarks);

        this.classGroups.forEach(group => {
          this.tasksData[group] = {
            session_planner: planners[group] || '',
            session_topic: topics[group] || '',
            activity_planner: activityPlanners[group] || '',
            activity: activities[group] || '',
            remarks: remarksData[group] || ''
          };
        });
      }
    } catch (err) {
      console.error('Failed to load task details:', err);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async saveTask() {
    this.isSubmitting = true;

    const dateRangeStr = `${this.weeklyTask.startDate} to ${this.weeklyTask.endDate}`;

    const sessionPlannerObj: { [key: string]: string } = {};
    const sessionTopicObj: { [key: string]: string } = {};
    const activityPlannerObj: { [key: string]: string } = {};
    const activityObj: { [key: string]: string } = {};
    const remarksObj: { [key: string]: string } = {};

    this.classGroups.forEach(group => {
      sessionPlannerObj[group] = this.tasksData[group].session_planner;
      sessionTopicObj[group] = this.tasksData[group].session_topic;
      activityPlannerObj[group] = this.tasksData[group].activity_planner;
      activityObj[group] = this.tasksData[group].activity;
      remarksObj[group] = this.tasksData[group].remarks;
    });

    const payload = {
      week_date_range: dateRangeStr,
      session_planner: sessionPlannerObj,
      session_topic: sessionTopicObj,
      activity_planner: activityPlannerObj,
      activity: activityObj,
      props: this.weeklyTask.props, // Saved as a shared string field now
      remarks: remarksObj,
      gift_planner: this.weeklyTask.giftPlanner,
      additional_task: this.weeklyTask.additionalTask
    };

    try {
      if (this.isEditMode && this.taskId) {
        const { error } = await this.supabase.client
          .from('weekly_tasks')
          .update(payload)
          .eq('id', this.taskId);

        if (error) throw error;
      } else {
        const { error } = await this.supabase.client
          .from('weekly_tasks')
          .insert([payload]);

        if (error) throw error;
      }

      this.router.navigate(['/weekly-tasks']);
    } catch (err: any) {
      console.error('Error saving task:', err);
      alert('Failed to save task: ' + (err.message || err));
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  goBack() {
    this.router.navigate(['/weekly-tasks']);
  }
}