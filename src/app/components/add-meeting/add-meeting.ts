import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Component({
  selector: 'app-add-meeting',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-meeting.html',
  styleUrls: ['./add-meeting.css']
})
export class AddMeetingComponent implements OnInit {
  private supabase: SupabaseClient;

  isEditMode: boolean = false;
  meetingId: string | null = null;
  isSubmitting: boolean = false;
  isLoading: boolean = true; 

  classGroups: string[] = [
    'Class 1-2', 
    'Class 3', 
    'Class 4', 
    'Class 5-7 Girls', 
    'Class 5-7 Boys', 
    'Class 8-10 Girls', 
    'Class 8-10 Boys'
  ]; 

  meeting = {
    meeting_date: new Date().toISOString().split('T')[0]
  };

  tasksData: { [key: string]: any } = {};
  selectedFiles: { [key: string]: File[] } = {};
  uploadedDocUrls: { [key: string]: string[] } = {};

  constructor(
    private route: ActivatedRoute, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.supabase = createClient(
      'https://mzbncwsizcsandcptylq.supabase.co', 
      'sb_publishable_lS4H48WeVoLRzIBpyg5IZQ_3uNthNyy'
    );
    
    this.classGroups.forEach(group => {
      this.tasksData[group] = {
        session_lead: '',
        session_topic: '',
        activity: '',
        gifts: '',
        props: '',
        remarks: '',
        docCount: 0
      };
      this.selectedFiles[group] = [];
      this.uploadedDocUrls[group] = [];
    });
  }

  async ngOnInit() {
    this.meetingId = this.route.snapshot.paramMap.get('id');
    if (this.meetingId) {
      this.isEditMode = true;
      await this.loadMeetingData(this.meetingId);
    } else {
      this.isLoading = false; 
    }
  }

  async loadMeetingData(id: string) {
    try {
      const { data, error } = await this.supabase
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

        this.classGroups.forEach(group => {
          // Fallback to legacy 'Class 3-4' if specific Class 3 or Class 4 data is missing
          const lookupKey = (group === 'Class 3' || group === 'Class 4') && !leads[group] && leads['Class 3-4'] 
            ? 'Class 3-4' 
            : group;

          this.tasksData[group] = {
            session_lead: leads[lookupKey] || '',
            session_topic: topics[lookupKey] || '',
            activity: activities[lookupKey] || '',
            gifts: giftsMap[lookupKey] || '',
            props: propsMap[lookupKey] || '',
            remarks: remarksMap[lookupKey] || '',
            docCount: 0
          };
          
          const docTarget = docs[lookupKey] || docs[group];
          if (docTarget) {
            const urlArray = typeof docTarget === 'string' ? docTarget.split(',').filter((u: string) => u.trim() !== '') : [];
            this.uploadedDocUrls[group] = urlArray;
            this.tasksData[group].docCount = urlArray.length;
          } else {
            this.uploadedDocUrls[group] = [];
          }
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

  onFilesSelected(event: any, group: string) {
    const files = event.target.files;
    if (files) {
      this.selectedFiles[group] = Array.from(files);
      this.tasksData[group].docCount = this.selectedFiles[group].length;
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

      this.classGroups.forEach(group => {
        sessionLeads[group] = this.tasksData[group].session_lead;
        sessionTopics[group] = this.tasksData[group].session_topic;
        activitiesMap[group] = this.tasksData[group].activity;
        giftsMap[group] = this.tasksData[group].gifts;
        propsMap[group] = this.tasksData[group].props;
        remarksMap[group] = this.tasksData[group].remarks;
        docUrlsMap[group] = this.uploadedDocUrls[group].join(',');
      });

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
        const { error } = await this.supabase
          .from('meetings')
          .update(payload)
          .eq('id', this.meetingId);

        if (error) throw error;
        alert('Session plan updated successfully!');
      } else {
        const { error } = await this.supabase
          .from('meetings')
          .insert([payload]);

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