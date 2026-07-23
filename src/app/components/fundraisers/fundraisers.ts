import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-fundraisers',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './fundraisers.html',
  styleUrls: ['./fundraisers.css']
})
export class FundraisersComponent implements OnInit {
  entries: any[] = [];
  isAdmin: boolean = true; 

  constructor(
    private supabase: SupabaseService, 
    private router: Router, 
    private cdr: ChangeDetectorRef
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && event.url === '/fundraisers') {
        this.fetchEntries();
      }
    });
  }

  ngOnInit() {
    this.fetchEntries();
  }

  // Explicitly route back to the dashboard to avoid browser history loops
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  async fetchEntries() {
    const { data, error } = await this.supabase.client
      .from('fund_entries')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching entries:', error);
    } else {
      this.entries = data || [];
      this.cdr.detectChanges(); 
    }
  }

  get totalCollected(): number {
    return this.entries
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  get totalUsed(): number {
    return this.entries
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  get currentBalance(): number {
    return this.totalCollected - this.totalUsed;
  }
}