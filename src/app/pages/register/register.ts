import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css']
})
export class RegisterComponent {
  email = '';
  password = '';
  fullName = '';
  role = 'volunteer';
  gender = 'male';
  age: number | null = null;
  phoneNumber = '';
  isSubmitting = false;

  constructor(
    private supabase: SupabaseService, 
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async onRegister() {
    if (!this.email || !this.password || !this.fullName || !this.age || !this.phoneNumber) {
      alert('Please fill in all required fields.');
      return;
    }

    if (this.isSubmitting) return;
    this.isSubmitting = true;
    this.cdr.detectChanges();

    try {
      const isAdmin = this.role === 'admin';

      const { data, error } = await this.supabase.client.auth.signUp({
        email: this.email.trim(),
        password: this.password,
        options: {
          data: {
            full_name: this.fullName,
            role: this.role,
            gender: this.gender,
            age: Number(this.age),
            phone_number: this.phoneNumber,
            is_admin: isAdmin,
            status: 'pending' // Force new registration to pending status
          }
        }
      });

      if (error) throw error;

      // Also explicitly insert/upsert into the profiles table if your trigger doesn't pick up status automatically
      if (data.user) {
        await this.supabase.client.from('profiles').upsert({
          id: data.user.id,
          email: this.email.trim(),
          full_name: this.fullName,
          role: this.role,
          gender: this.gender,
          age: Number(this.age),
          phone_number: this.phoneNumber,
          status: 'pending'
        });
      }

      // Ensure the newly registered session doesn't keep the user automatically logged in
      await this.supabase.client.auth.signOut();

      alert('Registration successful! Your account is pending admin verification.');
      this.router.navigate(['/login']);
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }
}