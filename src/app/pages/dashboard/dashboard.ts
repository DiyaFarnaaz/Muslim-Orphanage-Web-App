import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
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

      // Query profiles table safely using maybeSingle to prevent 406 errors
      const { data: profileData, error: profileError } = await this.supabase.client
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error loading profile data:', profileError);
      }

      if (profileData && profileData.full_name) {
        this.userName = profileData.full_name;
      } else if (user.user_metadata && user.user_metadata['full_name']) {
        this.userName = user.user_metadata['full_name'];
      } else {
        this.userName = 'User';
      }

      this.cdr.detectChanges();
    } catch (err) {
      console.error('Failed to load user profile:', err);
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