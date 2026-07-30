import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from './services/supabase';
import { MeetingOverlay } from './components/meeting-overlay/meeting-overlay';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MeetingOverlay
  ],
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

        // Hide nav on events page
        this.showNav = !event.url.includes('/events');

      }

    });

  }

  ngOnInit(): void {

    this.supabase.client.auth.onAuthStateChange((event) => {

      if (event === 'SIGNED_OUT') {

        this.router.navigate(['/']);

      }

    });

  }

}