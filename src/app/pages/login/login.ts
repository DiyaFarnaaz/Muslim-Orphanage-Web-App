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

  ngOnInit() {
    window.history.replaceState(null, '', window.location.href);
  }

  async onLogin() {
    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      });

      if (error) throw error;
      
      this.router.navigate(['/dashboard']).then(() => {
        window.history.replaceState(null, '', '/dashboard');
      });
    } catch (err: any) {
      alert('Login failed: ' + err.message);
    }
  }
}