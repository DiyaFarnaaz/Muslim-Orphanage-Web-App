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

  report = {
    session_lead_name: '',
    topic: '',
    session_date: new Date().toISOString().split('T')[0],
    class_group: '',
    activity: '',
    winner: '',
    feedback: '',
    doc_url: '',
    media_url: ''
  };

  docCount: number = 0;
  mediaCount: number = 0;

  private uploadedDocUrls: string[] = [];
  private uploadedMediaUrls: string[] = [];

  classGroups: string[] = [
    'Class 1-2', 
    'Class 3-4', 
    'Class 5-7 Girls', 
    'Class 5-7 Boys', 
    'Class 8-10 Girls', 
    'Class 8-10 Boys'
  ];

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

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Fetched session data successfully:', data);

      if (data) {
        // Safely parse and format date to YYYY-MM-DD for native date input compatibility
        let formattedDate = new Date().toISOString().split('T')[0];
        if (data.session_date) {
          const parsedDate = new Date(data.session_date);
          if (!isNaN(parsedDate.getTime())) {
            formattedDate = parsedDate.toISOString().split('T')[0];
          }
        }

        this.report = {
          session_lead_name: data.session_lead_name || '',
          topic: data.topic || '',
          session_date: formattedDate,
          class_group: data.class_group || '',
          activity: data.activity || '',
          winner: data.winner || '',
          feedback: data.feedback || '',
          doc_url: data.doc_url || '',
          media_url: data.media_url || ''
        };

        if (data.doc_url) {
          this.uploadedDocUrls = data.doc_url.split(',').filter((u: string) => u.trim() !== '');
          this.docCount = this.uploadedDocUrls.length;
        }
        if (data.media_url) {
          this.uploadedMediaUrls = data.media_url.split(',').filter((u: string) => u.trim() !== '');
          this.mediaCount = this.uploadedMediaUrls.length;
        }
      }
    } catch (err: any) {
      console.error('Error loading session report for edit:', err);
      alert('Could not load session details: ' + (err.message || err));
    } finally {
      this.isLoading = false; 
      this.cdr.detectChanges();
    }
  }

  goBack() {
    this.router.navigate(['/events']);
  }

  async onFilesSelected(event: any, type: 'doc' | 'media') {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `${Date.now()}_${file.name}`;
      
      const { data, error } = await this.supabase.client.storage
        .from('session-files')
        .upload(fileName, file);

      if (error) {
        console.error('Upload failed for file:', file.name, error.message);
      } else if (data) {
        const { data: urlData } = this.supabase.client.storage
          .from('session-files')
          .getPublicUrl(data.path, { download: false });
        
        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }
    }

    if (type === 'doc') {
      this.uploadedDocUrls = [...this.uploadedDocUrls, ...uploadedUrls];
      this.docCount = this.uploadedDocUrls.length;
      this.report.doc_url = this.uploadedDocUrls.join(',');
    } else {
      this.uploadedMediaUrls = [...this.uploadedMediaUrls, ...uploadedUrls];
      this.mediaCount = this.uploadedMediaUrls.length;
      this.report.media_url = this.uploadedMediaUrls.join(',');
    }
    this.cdr.detectChanges();
  }

  async submitReport() {
    this.isSubmitting = true;
    try {
      let error;
      if (this.isEditMode && this.sessionId) {
        const res = await this.supabase.client
          .from('sessions')
          .update(this.report)
          .eq('id', this.sessionId);
        error = res.error;
        if (!error) alert('Session report updated successfully!');
      } else {
        const res = await this.supabase.client
          .from('sessions')
          .insert([this.report]);
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
    }
  }
}