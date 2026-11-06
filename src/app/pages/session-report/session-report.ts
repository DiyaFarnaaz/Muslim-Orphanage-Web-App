import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-session-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-report.html',
  styleUrls: ['./session-report.css']
})
export class SessionReportComponent implements OnInit {
  
  isEditMode: boolean = false;
  sessionId: string | null = null;
  isSubmitting: boolean = false;
  isLoading: boolean = true; 
  
  isCustomClass: boolean = false;
  customClassInput: string = '';

  report = {
    session_lead_name: '',
    topic: '',
    session_date: new Date().toISOString().split('T')[0],
    class_group: '',
    activity: '',
    winner: '',
    feedback: ''
  };

  private readonly groupOrder = [
    'Class 1-4 Below Avg', 'Class 5-9 Below Avg',
    'Class 1-2', 'Class 3', 'Class 4', 'Class 3-4',
    'Class 5-7', 'Class 5-7 Girls', 'Class 5-7 Boys',
    'Class 8-9 Girls', 'Class 8-9 Boys',
    'Class 8-10 Girls', 'Class 8-10 Boys'
  ];

  classGroups: string[] = [...this.groupOrder, 'Other (type manually)...'];

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.sessionId = this.route.snapshot.queryParamMap.get('id');
    if (this.sessionId) {
      this.isEditMode = true;
      await this.loadSessionData(this.sessionId);
    } else {
      this.isLoading = false; 
    }
  }

  async loadSessionData(id: string) {
    console.log('Loading session report data for ID:', id);
    try {
      const { data, error } = await this.supabase.client
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        let formattedDate = new Date().toISOString().split('T')[0];
        if (data.session_date) {
          const parsedDate = new Date(data.session_date);
          if (!isNaN(parsedDate.getTime())) {
            formattedDate = parsedDate.toISOString().split('T')[0];
          }
        }

        let fetchedClassGroup = data.class_group || '';
        
        // If the saved class is not in the standard preset list, treat it as custom
        if (fetchedClassGroup && !this.groupOrder.includes(fetchedClassGroup)) {
          this.isCustomClass = true;
          this.customClassInput = fetchedClassGroup;
          this.report.class_group = 'Other (type manually)...';
        } else {
          this.report.class_group = fetchedClassGroup;
          this.isCustomClass = false;
        }

        this.report.session_lead_name = data.session_lead_name || '';
        this.report.topic = data.topic || '';
        this.report.session_date = formattedDate;
        this.report.activity = data.activity || '';
        this.report.winner = data.winner || '';
        this.report.feedback = data.feedback || '';
      }
    } catch (err: any) {
      console.error('Error loading session report for edit:', err);
      alert('Could not load session details: ' + (err.message || err));
    } finally {
      this.isLoading = false; 
      this.cdr.detectChanges();
    }
  }

  // Handle dropdown change immediately using ngModelChange
  onClassGroupChange(value: string) {
    if (value === 'Other (type manually)...') {
      this.isCustomClass = true;
      this.customClassInput = '';
    } else {
      this.isCustomClass = false;
      this.customClassInput = '';
    }
    this.cdr.detectChanges();
  }

  goBack() {
    this.router.navigate(['/events']);
  }

  async submitReport() {
    this.isSubmitting = true;
    try {
      const payload = { ...this.report };
      
      // If "Other" is selected, use the typed custom class value
      if (payload.class_group === 'Other (type manually)...') {
        const customVal = this.customClassInput.trim();
        if (!customVal) {
          alert('Please enter a custom class group name.');
          this.isSubmitting = false;
          return;
        }
        payload.class_group = customVal;
      }

      let error;
      if (this.isEditMode && this.sessionId) {
        const res = await this.supabase.client
          .from('sessions')
          .update(payload)
          .eq('id', this.sessionId);
        error = res.error;
        if (!error) alert('Session report updated successfully!');
      } else {
        const res = await this.supabase.client
          .from('sessions')
          .insert([payload]);
        error = res.error;
        if (!error) alert('Session report created successfully!');
      }

      if (error) throw error;
      this.router.navigate(['/events']); 
    } catch (err: any) {
      console.error('Error saving report:', err);
      alert('Error: ' + (err.message || 'Could not save record.'));
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }
}