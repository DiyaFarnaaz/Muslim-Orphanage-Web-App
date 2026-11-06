import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

interface GroupEntry {
  selected: string;      // preset name, or OTHER
  customName: string;    // used when selected === OTHER
  session_planner: string;
  session_topic: string;
  activity_planner: string;
  activity: string;
  remarks: string;
}

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

  readonly OTHER = '__other__';

  weeklyTask = {
    startDate: '',
    endDate: '',
    meetingOrganizer: '',
    giftPlanner: '',
    props: '',
    additionalTask: ''
  };

  presetGroups = [
    'Class 1-4 Below Avg', 'Class 5-9 Below Avg',
    'Class 1-2', 'Class 3', 'Class 4', 'Class 3-4',
    'Class 5-7', 'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-9 Girls', 'Class 8-9 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
  ];

  // Cards shown by default on a NEW plan
  defaultGroups = [
    'Class 1-2', 'Class 3', 'Class 4',
    'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
  ];

  entries: GroupEntry[] = [];

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  private blankEntry(name = ''): GroupEntry {
    const isPreset = this.presetGroups.includes(name);
    return {
      selected: name === '' ? '' : (isPreset ? name : this.OTHER),
      customName: isPreset ? '' : name,
      session_planner: '',
      session_topic: '',
      activity_planner: '',
      activity: '',
      remarks: ''
    };
  }

  entryName(e: GroupEntry): string {
    return (e.selected === this.OTHER ? e.customName : e.selected).trim();
  }

  addEntry() { this.entries.push(this.blankEntry()); }
  removeEntry(i: number) { this.entries.splice(i, 1); }

  async ngOnInit() {
    this.taskId = this.route.snapshot.paramMap.get('id');
    if (this.taskId) {
      this.isEditMode = true;
      await this.loadTaskData(this.taskId);
    } else {
      this.entries = this.defaultGroups.map(g => this.blankEntry(g));
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

        this.weeklyTask.meetingOrganizer = data.meeting_organizer || '';
        this.weeklyTask.giftPlanner = data.gift_planner || '';
        this.weeklyTask.props = data.props || '';
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

        const names = new Set<string>([
          ...Object.keys(planners), ...Object.keys(topics),
          ...Object.keys(activityPlanners), ...Object.keys(activities),
          ...Object.keys(remarksData)
        ]);

        this.entries = [...names].map(name => ({
          ...this.blankEntry(name),
          session_planner: planners[name] || '',
          session_topic: topics[name] || '',
          activity_planner: activityPlanners[name] || '',
          activity: activities[name] || '',
          remarks: remarksData[name] || ''
        }));
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

    const used = new Set<string>();
    for (const e of this.entries) {
      const name = this.entryName(e);
      if (!name) continue; // skip blank cards
      if (used.has(name)) {
        alert(`"${name}" is added twice. Please merge or rename it.`);
        this.isSubmitting = false;
        return;
      }
      used.add(name);
      sessionPlannerObj[name] = e.session_planner;
      sessionTopicObj[name] = e.session_topic;
      activityPlannerObj[name] = e.activity_planner;
      activityObj[name] = e.activity;
      remarksObj[name] = e.remarks;
    }

    const payload = {
      week_date_range: dateRangeStr,
      session_planner: sessionPlannerObj,
      session_topic: sessionTopicObj,
      activity_planner: activityPlannerObj,
      activity: activityObj,
      props: this.weeklyTask.props,
      remarks: remarksObj,
      meeting_organizer: this.weeklyTask.meetingOrganizer,
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