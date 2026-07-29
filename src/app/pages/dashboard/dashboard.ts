import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { filter } from 'rxjs/operators';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  userName: string = 'User';
  showCards: boolean = true;
  
  // User Profile & Modal State
  userProfile: any = null;
  showProfileModal: boolean = false;
  editProfileData: any = {};
  
  // Password Change State
  passwordData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  isUpdating: boolean = false;
  isChangingPassword: boolean = false;
  activeTab: 'details' | 'password' = 'details';

  constructor(
    private router: Router,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showCards = event.url === '/dashboard' || event.url === '/dashboard/';
    });
  }

  async ngOnInit() {
    this.showCards = this.router.url === '/dashboard' || this.router.url === '/dashboard/';
    await this.loadUserProfile();
  }

  async loadUserProfile() {
    try {
      const { data: { user }, error: authError } = await this.supabase.client.auth.getUser();
      
      if (authError || !user) {
        console.error('Error fetching auth user:', authError);
        return;
      }

      const { data: profileData, error: profileError } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile data:', profileError);
      }

      // Merge auth user email with profile metadata
      this.userProfile = {
        ...(profileData || {}),
        email: user.email,
        full_name: profileData?.full_name || user.user_metadata?.['full_name'] || 'User'
      };

      this.userName = this.userProfile.full_name;
      this.editProfileData = { ...this.userProfile };

      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  toggleProfileModal() {
    this.showProfileModal = !this.showProfileModal;
    if (this.showProfileModal) {
      this.editProfileData = { ...this.userProfile };
      this.activeTab = 'details';
    }
  }

  async updateProfileDetails() {
    this.isUpdating = true;
    try {
      // Exclude email and role from direct database updates
      const { id, email, role, ...updates } = this.editProfileData;

      const { error } = await this.supabase.client
        .from('profiles')
        .update(updates)
        .eq('id', this.userProfile.id);

      if (error) throw error;

      this.userProfile = { ...this.editProfileData };
      this.userName = this.userProfile.full_name || 'User';
      alert('Profile updated successfully!');
      this.showProfileModal = false;
    } catch (err: any) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile: ' + (err.message || err));
    } finally {
      this.isUpdating = false;
      this.cdr.detectChanges();
    }
  }

  async updatePassword() {
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }

    if (!this.passwordData.currentPassword || !this.passwordData.newPassword) {
      alert('Please fill in all password fields.');
      return;
    }

    this.isChangingPassword = true;
    try {
      // 1. Verify previous/current password by checking sign in
      const { error: signInError } = await this.supabase.client.auth.signInWithPassword({
        email: this.userProfile.email,
        password: this.passwordData.currentPassword
      });

      if (signInError) {
        alert('Previous password is incorrect.');
        this.isChangingPassword = false;
        return;
      }

      // 2. Update to new password via Supabase auth API
      const { error: updateError } = await this.supabase.client.auth.updateUser({
        password: this.passwordData.newPassword
      });

      if (updateError) throw updateError;

      alert('Password updated successfully!');
      this.passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
      this.activeTab = 'details';
    } catch (err: any) {
      console.error('Error changing password:', err);
      alert('Failed to update password: ' + (err.message || err));
    } finally {
      this.isChangingPassword = false;
      this.cdr.detectChanges();
    }
  }

  async onLogout() {
    try {
      await this.supabase.client.auth.signOut();
      this.router.navigate(['/login']);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }
}