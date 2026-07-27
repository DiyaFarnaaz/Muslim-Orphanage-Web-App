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
      // 1. Authenticate credentials
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });

      if (error) throw error;
      
      if (data.user) {
        // 2. Fetch profile status and role for gatekeeper check
        const { data: profile, error: profileError } = await this.supabase.client
          .from('profiles')
          .select('status, role')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        // 3. Gatekeeper check for pending or rejected statuses
        if (!profile || profile.status === 'pending') {
          await this.supabase.client.auth.signOut();
          alert('Your account is currently pending admin verification. Please wait for approval.');
          return;
        }

        if (profile.status === 'rejected') {
          await this.supabase.client.auth.signOut();
          alert('Your account request has been rejected by the administrator.');
          return;
        }

        // 4. Route based on role if approved
       // 4. Route based on role if approved (Direct both roles to /dashboard or your actual dashboard route)
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