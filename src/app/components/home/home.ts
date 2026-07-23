import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent {
  constructor(private router: Router) {}

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

  onLogout() {
    localStorage.removeItem('isLoggedIn');
    this.router.navigate(['/']).then(() => {
      window.history.replaceState(null, '', '/');
    });
  }
}