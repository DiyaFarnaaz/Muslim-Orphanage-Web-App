import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-update-password',
  templateUrl: './update-password.html',
  styleUrls: ['./update-password.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class UpdatePasswordComponent {
  verifyForm: FormGroup;
  passwordForm: FormGroup;
  tokenVerified = false;

  constructor(
    private fb: FormBuilder, 
    private router: Router, 
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    this.verifyForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      token: ['', [Validators.required]]
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  async verifyToken() {
    if (this.verifyForm.invalid) return;
    const { email, token } = this.verifyForm.value;

    const { error } = await this.supabase.client.auth.verifyOtp({
      email,
      token,
      type: 'recovery'
    });

    if (error) {
      alert('Invalid or expired code: ' + error.message);
    } else {
      this.tokenVerified = true;
      this.cdr.detectChanges(); 
      alert('Code verified successfully! Now enter your new password.');
    }
  }

  async updatePassword() {
    if (this.passwordForm.invalid) return;
    const newPassword = this.passwordForm.value.password;

    const { error } = await this.supabase.client.auth.updateUser({
      password: newPassword
    });

    if (error) {
      alert('Error updating password: ' + error.message);
    } else {
      alert('Password updated successfully! Please log in with your new password.');
      
      // Kill the recovery session so they are forced to log in manually
      await this.supabase.client.auth.signOut();
      
      // Navigate to login page
      this.router.navigate(['/login']);
    }
  }

  async goBack() {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/login']);
  }
}