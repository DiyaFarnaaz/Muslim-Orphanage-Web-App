import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  fullName = '';
  email = '';
  password = '';
  role = 'volunteer';
  gender = 'female';
  phoneNumber: string = '';
  age: number | null = null;

  constructor(private supabase: SupabaseService, private router: Router) {}

  async onRegister() {
    try {
      const isAdmin = this.role === 'admin';

      const { data, error } = await this.supabase.client.auth.signUp({
        email: this.email,
        password: this.password,
        options: {
          data: {
            full_name: this.fullName,
            role: this.role,
            gender: this.gender,
            phone_number: this.phoneNumber,
            age: (this.age !== null && this.age > 0) ? this.age : null,
            is_admin: isAdmin
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          alert('This email is already registered. Please log in.');
          this.router.navigate(['/login']);
          return;
        }
        throw error;
      }

      if (data.user) {
        // Sign out immediately so Supabase's auto-login doesn't push them to the dashboard
        await this.supabase.client.auth.signOut();
        
        alert('Registration successful! Please log in.');
        this.router.navigate(['/login']);
      }
    } catch (err: any) {
      console.error('Registration Error:', err);
      alert('An unexpected error occurred: ' + (err.message || JSON.stringify(err)));
    }
  }
}