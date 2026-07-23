import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-volunteer',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './volunteer.html',
  styleUrls: ['./volunteer.css']
})
export class VolunteerComponent implements OnInit {
  volunteers: any[] = [];
  loading: boolean = true;
  isAdmin: boolean = false;
  editingProfileId: string | null = null;
  editForm: any = {};

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.checkAdminAndLoadVolunteers();
  }

  goBack() {
    this.location.back();
  }

  async checkAdminAndLoadVolunteers() {
    this.loading = true;
    try {
      const sessionResponse = await this.supabase.client.auth.getSession();
      const session = sessionResponse?.data?.session;
      
      if (!session) {
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }
      
      // Check if current user is admin
      const { data: currentUserData } = await this.supabase.client
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle();

      this.isAdmin = currentUserData?.is_admin || false;

      // Fetch all profiles for the directory
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('id, full_name, email, gender, age, phone_number, is_admin');
        
      if (error) {
        console.error('Supabase query error:', error.message);
      }

      this.volunteers = data || [];
    } catch (err) {
      console.error('Unexpected error loading volunteers:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  startEdit(volunteer: any) {
    if (!this.isAdmin) {
      alert('Unauthorized: Only administrators can edit profiles.');
      return;
    }
    this.editingProfileId = volunteer.id;
    this.editForm = { ...volunteer };
    this.cdr.detectChanges();
  }

  cancelEdit() {
    this.editingProfileId = null;
    this.editForm = {};
    this.cdr.detectChanges();
  }

  async updateProfile(id: string) {
    if (!this.isAdmin) {
      alert('Unauthorized action.');
      return;
    }

    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({
          full_name: this.editForm.full_name,
          gender: this.editForm.gender,
          age: this.editForm.age,
          phone_number: this.editForm.phone_number
        })
        .eq('id', id);

      if (error) {
        alert('Error updating profile: ' + error.message);
        return;
      }

      // Update local array
      const index = this.volunteers.findIndex(v => v.id === id);
      if (index !== -1) {
        this.volunteers[index] = { ...this.volunteers[index], ...this.editForm };
      }

      this.editingProfileId = null;
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Unexpected error updating profile:', err);
    } finally {
      this.cdr.detectChanges();
    }
  }

  async deleteProfile(id: string) {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    
    const { error } = await this.supabase.client.from('profiles').delete().eq('id', id);
    if (error) {
      alert('Error deleting profile: ' + error.message);
      return;
    }

    this.volunteers = this.volunteers.filter(v => v.id !== id);
    this.cdr.detectChanges();
  }
}