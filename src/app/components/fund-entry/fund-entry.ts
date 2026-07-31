import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-fund-entry',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './fund-entry.html',
  styleUrls: ['./fund-entry.css']
})
export class FundEntryComponent implements OnInit {
  entryId: string | null = null;
  isEditMode = false;
  loading = false;

  newEntry = { 
    type: 'expense', 
    amount: 0, 
    description: '', 
    date: new Date().toISOString().split('T')[0] 
  };

  constructor(
    private supabase: SupabaseService, 
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.entryId = this.route.snapshot.paramMap.get('id');
    if (this.entryId) {
      this.isEditMode = true;
      await this.fetchEntryDetails(this.entryId);
    }
  }

  async fetchEntryDetails(id: string) {
    this.loading = true;
    try {
      const { data, error } = await this.supabase.client
        .from('fund_entries')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching entry:', error.message);
        alert('Could not load entry details.');
      } else if (data) {
        this.newEntry = {
          type: data.type,
          amount: data.amount,
          description: data.description || '',
          date: data.date
        };
      }
    } catch (err) {
      console.error('Fetch exception:', err);
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  goBack() {
    this.router.navigate(['/fundraisers']);
  }

  async submitEntry() {
    this.newEntry.amount = Number(this.newEntry.amount);
    let error;

    if (this.isEditMode && this.entryId) {
      // Update existing record
      const res = await this.supabase.client
        .from('fund_entries')
        .update(this.newEntry)
        .eq('id', this.entryId);
      error = res.error;
    } else {
      // Insert new record
      const res = await this.supabase.client
        .from('fund_entries')
        .insert([this.newEntry]);
      error = res.error;
    }
    
    if (error) {
      if (error.code === '42501' || error.message.includes('policy')) {
        alert('Access Denied: Only administrators can make or edit fund entries.');
      } else {
        alert('Error saving entry: ' + error.message);
      }
    } else {
      alert(this.isEditMode ? 'Fund entry updated successfully!' : 'Fund entry added successfully!');
      this.router.navigate(['/fundraisers']);
    }
  }
}