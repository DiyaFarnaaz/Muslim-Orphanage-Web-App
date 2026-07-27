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
  pendingUsers: any[] = [];
  loading: boolean = true;
  isAdmin: boolean = false;
  editingProfileId: string | null = null;
  editForm: any = {};
  
  // Track selected target role for each pending user in the UI dropdown
  selectedRoles: { [key: string]: string } = {};

  constructor(
    private supabase: SupabaseService,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.checkAdminAndLoadProfiles();
  }

  goBack() {
    this.location.back();
  }

  async checkAdminAndLoadProfiles() {
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
        .select('is_admin, role, status')
        .eq('id', session.user.id)
        .maybeSingle();

      this.isAdmin = currentUserData?.is_admin || currentUserData?.role === 'admin' || false;

      // Fetch all profiles from the database
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('id, full_name, email, gender, age, phone_number, is_admin, role, status');
        
      if (error) {
        console.error('Supabase query error:', error.message);
      }

      const allProfiles = data || [];

      // Separate pending users from approved/active ones
      this.pendingUsers = allProfiles.filter(p => p.status === 'pending');
      this.volunteers = allProfiles.filter(p => p.status !== 'pending');

      // Initialize default role selections for pending users based on what they requested
      this.pendingUsers.forEach(user => {
        this.selectedRoles[user.id] = user.role || 'volunteer';
      });

    } catch (err) {
      console.error('Unexpected error loading profiles:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // --- Admin Approval Workflow Methods ---

  async approveUser(user: any) {
    if (!this.isAdmin) {
      alert('Unauthorized action.');
      return;
    }

    const targetRole = this.selectedRoles[user.id] || 'volunteer';
    const makeAdmin = targetRole === 'admin';

    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({
          status: 'approved',
          role: targetRole,
          is_admin: makeAdmin
        })
        .eq('id', user.id);

      if (error) {
        alert('Error approving user: ' + error.message);
        return;
      }

      alert(`User approved successfully as ${targetRole.toUpperCase()}!`);
      await this.checkAdminAndLoadProfiles();
    } catch (err: any) {
      console.error('Unexpected error during approval:', err);
      alert('Error: ' + err.message);
    }
  }

  async rejectUser(userId: string) {
    if (!this.isAdmin) return;
    if (!confirm('Are you sure you want to reject and delete this registration request?')) return;

    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) {
        alert('Error rejecting user: ' + error.message);
        return;
      }

      alert('User registration request rejected.');
      await this.checkAdminAndLoadProfiles();
    } catch (err: any) {
      console.error('Unexpected error rejecting user:', err);
    }
  }

  // --- Existing Profile Management Methods ---

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

    const newRole = this.editForm.role || 'volunteer';
    const makeAdmin = newRole === 'admin';

    try {
      const { error } = await this.supabase.client
        .from('profiles')
        .update({
          full_name: this.editForm.full_name,
          gender: this.editForm.gender,
          age: this.editForm.age,
          phone_number: this.editForm.phone_number,
          role: newRole,
          is_admin: makeAdmin
        })
        .eq('id', id);

      if (error) {
        alert('Error updating profile: ' + error.message);
        return;
      }

      const index = this.volunteers.findIndex(v => v.id === id);
      if (index !== -1) {
        this.volunteers[index] = { 
          ...this.volunteers[index], 
          ...this.editForm, 
          role: newRole, 
          is_admin: makeAdmin 
        };
      }

      this.editingProfileId = null;
      alert('Profile updated successfully!');
      await this.checkAdminAndLoadProfiles();
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