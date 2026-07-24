import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-fundraisers',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './fundraisers.html',
  styleUrls: ['./fundraisers.css']
})
export class FundraisersComponent implements OnInit {
  fundEntries: any[] = [];
  loading = true;

  totalCollected = 0;
  totalUsed = 0;
  currentBalance = 0;
  isAdmin: boolean = false;

  constructor(
    private supabase: SupabaseService, 
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit() {
    const safetyTimer = setTimeout(() => {
      if (this.loading) {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }, 4000);

    try {
      await this.checkAdminStatus();
      await this.fetchFundEntries();
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      clearTimeout(safetyTimer);
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async checkAdminStatus() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (!user) return;

      const { data: profile } = await this.supabase.client
        .from('profiles')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

      if (profile && (profile.is_admin || profile.role === 'admin')) {
        this.isAdmin = true;
      }
    } catch (err) {
      console.error('Error verifying admin status:', err);
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async fetchFundEntries() {
    try {
      const { data, error } = await this.supabase.client
        .from('fund_entries')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error.message);
      } else {
        this.fundEntries = data || [];
        this.calculateMetrics();
      }
    } catch (err) {
      console.error('Fetch exception:', err);
    }
  }

  calculateMetrics() {
    this.totalCollected = 0;
    this.totalUsed = 0;

    this.fundEntries.forEach(entry => {
      const amount = Number(entry.amount) || 0;
      if (entry.type === 'income') {
        this.totalCollected += amount;
      } else if (entry.type === 'expense') {
        this.totalUsed += amount;
      }
    });

    this.currentBalance = this.totalCollected - this.totalUsed;
  }
}