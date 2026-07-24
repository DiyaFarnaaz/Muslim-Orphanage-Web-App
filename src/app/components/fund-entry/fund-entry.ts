import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-fund-entry',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './fund-entry.html',
  styleUrls: ['./fund-entry.css']
})
export class FundEntryComponent {
  newEntry = { 
    type: 'expense', 
    amount: 0, 
    description: '', 
    date: new Date().toISOString().split('T')[0] 
  };

  constructor(private supabase: SupabaseService, private router: Router) {}

  goBack() {
    this.router.navigate(['/fundraisers']);
  }

  async submitEntry() {
    this.newEntry.amount = Number(this.newEntry.amount);

    const { error } = await this.supabase.client
      .from('fund_entries')
      .insert([this.newEntry]);
    
    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        alert('Access Denied: Only administrators can make fund entries.');
      } else {
        alert('Error saving entry: ' + error.message);
      }
    } else {
      alert('Fund entry added successfully!');
      this.router.navigate(['/fundraisers']);
    }
  }
}