import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-add-meeting',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './add-meeting.html',
  styleUrl: './add-meeting.css'
})
export class AddMeetingComponent {
  readonly classGroups = ['1-4', '5-7', '8-10'];

  meeting = {
    meeting_date: '',
    meeting_link: ''
  };

  tasksData: any = {
    '1-4': { session_lead: '', session_prep: '', activity: '', gifts_props: '', doc_url: '', docCount: 0 },
    '5-7': { session_lead: '', session_prep: '', activity: '', gifts_props: '', doc_url: '', docCount: 0 },
    '8-10': { session_lead: '', session_prep: '', activity: '', gifts_props: '', doc_url: '', docCount: 0 }
  };

  private uploadedDocUrls: { [key: string]: string[] } = {
    '1-4': [],
    '5-7': [],
    '8-10': []
  };

  isSubmitting: boolean = false;

  constructor(
    private supabase: SupabaseService, 
    private router: Router,
    private location: Location
  ) {}

  goBack(): void {
    this.location.back();
  }

  async onFilesSelected(event: any, group: string) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    const newUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `${Date.now()}_${file.name}`;
      
      // Explicitly using the 'session-docs' bucket as requested
      const { data, error } = await this.supabase.client.storage
        .from('session-docs')
        .upload(fileName, file);

      if (error) {
        console.error(`Upload failed for group ${group}:`, error.message);
      } else if (data) {
        const { data: urlData } = this.supabase.client.storage
          .from('session-docs')
          .getPublicUrl(data.path);
        
        if (urlData?.publicUrl) {
          newUrls.push(urlData.publicUrl);
        }
      }
    }

    this.uploadedDocUrls[group] = [...this.uploadedDocUrls[group], ...newUrls];
    this.tasksData[group].docCount = this.uploadedDocUrls[group].length;
    this.tasksData[group].doc_url = this.uploadedDocUrls[group].join(',');
  }

  async saveMeeting() {
    this.isSubmitting = true;
    try {
      const { error } = await this.supabase.client.from('meetings').insert([{
        meeting_date: this.meeting.meeting_date,
        meeting_link: this.meeting.meeting_link,
        session_lead: JSON.stringify({
          '1-4': this.tasksData['1-4'].session_lead,
          '5-7': this.tasksData['5-7'].session_lead,
          '8-10': this.tasksData['8-10'].session_lead
        }),
        session_prep: JSON.stringify({
          '1-4': this.tasksData['1-4'].session_prep,
          '5-7': this.tasksData['5-7'].session_prep,
          '8-10': this.tasksData['8-10'].session_prep
        }),
        activity: JSON.stringify({
          '1-4': this.tasksData['1-4'].activity,
          '5-7': this.tasksData['5-7'].activity,
          '8-10': this.tasksData['8-10'].activity
        }),
        gifts_props: JSON.stringify({
          '1-4': this.tasksData['1-4'].gifts_props,
          '5-7': this.tasksData['5-7'].gifts_props,
          '8-10': this.tasksData['8-10'].gifts_props
        }),
        doc_url: JSON.stringify({
          '1-4': this.tasksData['1-4'].doc_url,
          '5-7': this.tasksData['5-7'].doc_url,
          '8-10': this.tasksData['8-10'].doc_url
        })
      }]);

      if (error) throw error;

      alert('Meeting saved successfully!');
      this.router.navigate(['/meetings']);
    } catch (err) {
      console.error('Error saving meeting:', err);
      alert('Failed to save meeting. Check console for details.');
    } finally {
      this.isSubmitting = false;
    }
  }
}