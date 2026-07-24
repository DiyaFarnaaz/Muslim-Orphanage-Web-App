import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
  constructor(private router: Router, private supabase: SupabaseService) {}

  async ngOnInit() {
    // Session auto-redirect disabled for testing public pages
    // const { data: { session } } = await this.supabase.client.auth.getSession();
    // if (session) {
    //   this.router.navigate(['/dashboard']);
    // }
  }

  // Smooth scrolls to specific sections on the same page
  scrollToSection(sectionId: string) {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Handles navigation to separate pages like login or register
  navigateTo(path: string) {
    this.router.navigate([`/${path}`]);
  }

  async onLogout() {
    // Sign out from Supabase and clear session storage
    await this.supabase.client.auth.signOut();
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['/']).then(() => {
      window.history.replaceState(null, '', '/');
    });
  }
}