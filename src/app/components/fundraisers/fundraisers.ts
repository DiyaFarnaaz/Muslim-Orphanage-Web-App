import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-fundraisers',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule],
  templateUrl: './fundraisers.html',
  styleUrls: ['./fundraisers.css']
})
export class FundraisersComponent implements OnInit {
  fundEntries: any[] = [];
  accounts: any[] = [];
  loading = true;
  checkingRole = true; // Added to block rendering until role check completes

  totalCollected = 0;
  totalUsed = 0;
  currentBalance = 0;
  isAdmin: boolean = false;

  // Edit Accounts Modal State
  showAccountModal = false;
  selectedAccount: any = null;
  newAccountBalance = 0;

  constructor(
    private supabase: SupabaseService, 
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  async ngOnInit() {
    const safetyTimer = setTimeout(() => {
      if (this.loading || this.checkingRole) {
        this.loading = false;
        this.checkingRole = false;
        this.cdr.detectChanges();
      }
    }, 4000);

    try {
      await this.checkAdminStatus();
      await Promise.all([this.fetchFundEntries(), this.fetchAccounts()]);
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      clearTimeout(safetyTimer);
      this.loading = false;
      this.checkingRole = false;
      this.cdr.detectChanges();
    }
  }

  async checkAdminStatus() {
    this.checkingRole = true;
    this.isAdmin = false;

    try {
      const { data: { user }, error: authError } = await this.supabase.client.auth.getUser();
      if (authError || !user) {
        this.isAdmin = false;
        return;
      }

      // Rely strictly on the profiles database table to avoid legacy metadata overrides
      const { data: profile, error: profileError } = await this.supabase.client
        .from('profiles')
        .select('is_admin, role')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && (profile.is_admin === true || profile.role === 'admin')) {
        this.isAdmin = true;
      } else {
        this.isAdmin = false;
      }
    } catch (err) {
      console.error('Error verifying admin status:', err);
      this.isAdmin = false;
    } finally {
      this.checkingRole = false;
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

  async fetchAccounts() {
    try {
      const { data, error } = await this.supabase.client
        .from('fund_accounts')
        .select('*');

      if (error) {
        console.error('Error fetching accounts:', error.message);
      } else {
        this.accounts = data || [];
      }
    } catch (err) {
      console.error('Fetch accounts exception:', err);
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

  openEditAccountModal(account: any) {
    if (!this.isAdmin) return; // Extra layer of security
    this.selectedAccount = account;
    this.newAccountBalance = account.balance;
    this.showAccountModal = true;
  }

  closeAccountModal() {
    this.showAccountModal = false;
    this.selectedAccount = null;
  }

  async updateAccountBalance() {
    if (!this.isAdmin) {
      alert('Unauthorized action.');
      return;
    }
    if (!this.selectedAccount) return;

    try {
      const { error } = await this.supabase.client
        .from('fund_accounts')
        .update({ balance: Number(this.newAccountBalance), updated_at: new Date() })
        .eq('id', this.selectedAccount.id);

      if (error) {
        alert('Failed to update balance: ' + error.message);
      } else {
        this.closeAccountModal();
        await this.fetchAccounts();
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error('Update account exception:', err);
    }
  }

  editEntry(entry: any) {
    if (!this.isAdmin) return;
    this.router.navigate(['/fund-entry', entry.id]);
  }

  async deleteEntry(id: string) {
    if (!this.isAdmin) {
      alert('Unauthorized action.');
      return;
    }
    if (!confirm('Are you sure you want to delete this fund entry?')) return;

    try {
      const { error } = await this.supabase.client
        .from('fund_entries')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting entry:', error.message);
        alert('Failed to delete entry.');
      } else {
        this.fundEntries = this.fundEntries.filter(entry => entry.id !== id);
        this.calculateMetrics();
        this.cdr.detectChanges();
      }
    } catch (err) {
      console.error('Delete exception:', err);
    }
  }
}