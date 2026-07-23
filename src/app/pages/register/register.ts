import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';
import { Router } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule],
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
  age: number | null = null; // Stored as a number or null

  constructor(private supabase: SupabaseService, private router: Router) {}

  async onRegister() {
  try {
    // 1. Attempt to sign up
    const { data, error } = await this.supabase.client.auth.signUp({
      email: this.email,
      password: this.password,
    });

    // Handle "User already exists" specifically
    if (error) {
      if (error.message.includes('already registered')) {
        alert('This email is already registered. Please log in.');
        this.router.navigate(['/login']);
        return; // Stop here
      }
      throw error;
    }

    // 2. If Auth was successful, create the profile
    if (data.user) {
      const { error: profileError } = await this.supabase.client
        .from('profiles')
        .insert([{ 
          id: data.user.id,
          email: this.email,
          full_name: this.fullName, 
          role: this.role, 
          gender: this.gender,
          phone_number: this.phoneNumber, 
          age: (this.age !== null && this.age > 0) ? this.age : null 
        }]);

      if (profileError) {
        console.error('Profile Insert Error:', profileError);
        alert('Account created, but profile update failed: ' + profileError.message);
      } else {
        alert('Registration successful!');
        this.router.navigate(['/login']);
      }
    }
  } catch (err: any) {
    console.error('Registration Error:', err);
    alert('An unexpected error occurred: ' + err.message);
  }
}
}