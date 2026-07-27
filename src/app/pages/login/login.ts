import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  email = '';
  password = '';

  constructor(private supabase: SupabaseService, private router: Router) {}

  async ngOnInit() {
    window.history.replaceState(null, '', window.location.href);

    // When the user clicks the email confirmation link and gets redirected here,
    // Supabase auto-logs them in. We sign them out immediately so they are forced 
    // to manually type their credentials on this login page.
    try {
      const { data } = await this.supabase.client.auth.getSession();
      if (data.session) {
        await this.supabase.client.auth.signOut();
      }
    } catch (err) {
      console.error('Error clearing session on login init:', err);
    }
  }

  async onLogin() {
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });

      if (error) throw error;
      
      if (data.user) {
        const targetRoute = '/dashboard';

        this.router.navigate([targetRoute]).then(() => {
          window.history.replaceState(null, '', targetRoute);
        });
      }
    } catch (err: any) {
      alert('Login failed: ' + err.message);
    }
  }

  async onForgotPassword() {
    if (!this.email) {
      alert('Please enter your email address first in the email field.');
      return;
    }

    try {
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(this.email);

      if (error) throw error;
      
      alert('OTP sent to your email! Redirecting to verification page...');
      this.router.navigate(['/update-password']);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }
}