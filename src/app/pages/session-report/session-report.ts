import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-session-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './session-report.html',
  styleUrls: ['./session-report.css']
})
export class SessionReportComponent implements OnInit {
  
  report = {
    session_lead_name: '',
    topic: '',
    session_date: '',
    class_group: '',
    start_time: '',
    end_time: '',
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

  timeSlots: string[] = [];
  isSubmitting: boolean = false;

  constructor(
    private supabase: SupabaseService,
    private location: Location,
    private router: Router
  ) {}

  ngOnInit() {
    this.generateTimeSlots();
  }

  generateTimeSlots() {
    const slots: string[] = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        let period = hour >= 12 ? 'PM' : 'AM';
        let adjustedHour = hour > 12 ? hour - 12 : hour;
        if (adjustedHour === 0) adjustedHour = 12;

        const formattedMinute = minute === 0 ? '00' : `${minute}`;
        slots.push(`${adjustedHour}:${formattedMinute} ${period}`);
      }
    }
    this.timeSlots = slots;
  }

  goBack() {
    this.location.back();
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
          .getPublicUrl(data.path);
        
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
  }

  async submitReport() {
    this.isSubmitting = true;
    
    const { error } = await this.supabase.client
      .from('sessions')
      .insert([this.report]);

    this.isSubmitting = false;

    if (error) {
      alert('Error submitting report: ' + error.message);
    } else {
      this.router.navigate(['/events']); 
    }
  }
}