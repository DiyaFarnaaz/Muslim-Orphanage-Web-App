import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from './services/supabase';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html',
})
export class AppComponent implements OnInit {
  showNav = true;

  constructor(
    private router: Router,
    private supabase: SupabaseService
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Hides the nav when the URL contains 'events'
        this.showNav = !event.url.includes('/events');
      }
    });
  }

  ngOnInit() {
    // Listen for sign-out events to redirect safely to the homepage
    this.supabase.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.router.navigate(['/']);
      }
    });
  }
}