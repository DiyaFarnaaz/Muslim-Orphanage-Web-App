import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

interface MeetingEntry {
  selected: string;
  customName: string;
  session_lead: string;
  session_topic: string;
  activity: string;
  gifts: string;
  props: string;
  remarks: string;
  files: File[];
  docUrls: string[];
}

@Component({
  selector: 'app-add-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-meeting.html',
  styleUrls: ['./add-meeting.css']
})
export class AddMeetingComponent implements OnInit {
  isEditMode = false;
  meetingId: string | null = null;
  isSubmitting = false;
  isLoading = true;

  readonly OTHER = '__other__';

  presetGroups = [
    'Class 1-4 Below Avg', 'Class 5-9 Below Avg',
    'Class 1-2', 'Class 3', 'Class 4', 'Class 3-4',
    'Class 5-7', 'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-9 Girls', 'Class 8-9 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
  ];

  defaultGroups = [
    'Class 1-2', 'Class 3', 'Class 4',
    'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
  ];

  meeting = {
    meeting_date: new Date().toISOString().split('T')[0]
  };

  entries: MeetingEntry[] = [];

  constructor(
    private supabase: SupabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  private blankEntry(name = ''): MeetingEntry {
    const isPreset = this.presetGroups.includes(name);
    return {
      selected: name === '' ? '' : (isPreset ? name : this.OTHER),
      customName: isPreset ? '' : name,
      session_lead: '', session_topic: '', activity: '',
      gifts: '', props: '', remarks: '',
      files: [], docUrls: []
    };
  }

  entryName(e: MeetingEntry): string {
    return (e.selected === this.OTHER ? e.customName : e.selected).trim();
  }

  docCount(e: MeetingEntry): number {
    return e.files.length + e.docUrls.length;
  }

  addEntry() { this.entries.push(this.blankEntry()); }
  removeEntry(i: number) { this.entries.splice(i, 1); }

  async ngOnInit() {
    this.meetingId = this.route.snapshot.paramMap.get('id');
    if (this.meetingId) {
      this.isEditMode = true;
      await this.loadMeetingData(this.meetingId);
    } else {
      this.entries = this.defaultGroups.map(g => this.blankEntry(g));
      this.isLoading = false;
    }
  }

  async loadMeetingData(id: string) {
    try {
      const { data, error } = await this.supabase.client
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        this.meeting.meeting_date = data.meeting_date;

        const parseField = (fieldData: any) => {
          if (!fieldData) return {};
          return typeof fieldData === 'string' ? JSON.parse(fieldData) : fieldData;
        };

        const leads = parseField(data.session_lead);
        const topics = parseField(data.session_topic);
        const activities = parseField(data.activity);
        const giftsMap = parseField(data.gifts);
        const propsMap = parseField(data.props);
        const remarksMap = parseField(data.remarks);
        const docs = parseField(data.doc_url);

        const names = new Set<string>([
          ...Object.keys(leads), ...Object.keys(topics), ...Object.keys(activities),
          ...Object.keys(giftsMap), ...Object.keys(propsMap),
          ...Object.keys(remarksMap), ...Object.keys(docs)
        ]);

        this.entries = [...names].map(name => {
          const d = docs[name];
          const urls = typeof d === 'string'
            ? d.split(',').filter((u: string) => u.trim() !== '')
            : [];
          return {
            ...this.blankEntry(name),
            session_lead: leads[name] || '',
            session_topic: topics[name] || '',
            activity: activities[name] || '',
            gifts: giftsMap[name] || '',
            props: propsMap[name] || '',
            remarks: remarksMap[name] || '',
            docUrls: urls
          };
        });
      }
    } catch (err: any) {
      console.error('Error loading session plan for edit:', err);
      alert('Could not load session details: ' + (err.message || err));
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onFilesSelected(event: any, e: MeetingEntry) {
    const files = event.target.files;
    if (files) {
      e.files = Array.from(files);
    }
  }

  async saveMeeting() {
    this.isSubmitting = true;
    try {
      const sessionLeads: any = {};
      const sessionTopics: any = {};
      const activitiesMap: any = {};
      const giftsMap: any = {};
      const propsMap: any = {};
      const remarksMap: any = {};
      const docUrlsMap: any = {};

      const used = new Set<string>();
      for (const e of this.entries) {
        const name = this.entryName(e);
        if (!name) continue;
        if (used.has(name)) {
          alert(`"${name}" is added twice. Please merge or rename it.`);
          this.isSubmitting = false;
          return;
        }
        used.add(name);
        sessionLeads[name] = e.session_lead;
        sessionTopics[name] = e.session_topic;
        activitiesMap[name] = e.activity;
        giftsMap[name] = e.gifts;
        propsMap[name] = e.props;
        remarksMap[name] = e.remarks;
        docUrlsMap[name] = e.docUrls.join(',');
      }

      const payload = {
        meeting_date: this.meeting.meeting_date,
        session_lead: sessionLeads,
        session_topic: sessionTopics,
        activity: activitiesMap,
        gifts: giftsMap,
        props: propsMap,
        remarks: remarksMap,
        doc_url: docUrlsMap
      };

      if (this.isEditMode && this.meetingId) {
        const { error } = await this.supabase.client
          .from('meetings').update(payload).eq('id', this.meetingId);
        if (error) throw error;
        alert('Session plan updated successfully!');
      } else {
        const { error } = await this.supabase.client
          .from('meetings').insert([payload]);
        if (error) throw error;
        alert('Session plan created successfully!');
      }

      this.router.navigate(['/meetings']);
    } catch (err: any) {
      console.error('Error saving session plan:', err);
      alert('Error: ' + (err.message || 'Could not save record.'));
    } finally {
      this.isSubmitting = false;
    }
  }

  goBack() {
    this.router.navigate(['/meetings']);
  }
}