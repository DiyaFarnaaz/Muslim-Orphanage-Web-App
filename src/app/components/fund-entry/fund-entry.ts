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
  // Ensure 'amount' here matches your Supabase table column name exactly
  newEntry = { 
    type: 'income', 
    amount: 0, 
    description: '', 
    date: new Date().toISOString().split('T')[0] 
  };

  constructor(private supabase: SupabaseService, private router: Router) {}

  async submitEntry() {
    // Basic validation to ensure amount is a number
    this.newEntry.amount = Number(this.newEntry.amount);

    const { error } = await this.supabase.client
      .from('fund_entries')
      .insert([this.newEntry]);
    
    if (error) {
      alert('Error saving entry: ' + error.message);
    } else {
      this.router.navigate(['/fundraisers']);
    }
  }
}