import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { CommonModule } from '@angular/common';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  userName: string = '';
  showCards: boolean = true;

  constructor(
    private supabase: SupabaseService, 
    private router: Router
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.showCards = event.url === '/dashboard';
      }
    });
  }

  async ngOnInit() {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    
    if (!session) {
      this.router.navigate(['/login']);
      return;
    }

    if (session?.user) {
      const { data, error } = await this.supabase.client
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (data && data.full_name) {
        this.userName = data.full_name;
      } else if (session.user.user_metadata?.['full_name'] || session.user.user_metadata?.['name']) {
        this.userName = session.user.user_metadata['full_name'] || session.user.user_metadata['name'];
      } else if (session.user.email) {
        this.userName = session.user.email.split('@')[0];
      } else {
        this.userName = 'User';
      }

      if (error) {
        console.error('Error fetching profile:', error);
      }
    }
  }

 async onLogout() {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/']); // Changed from '/login' to '/'
  }
}