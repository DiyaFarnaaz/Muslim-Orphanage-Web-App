import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-batches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './batches.html',
  styles: [`
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .muted { color: #666; font-size: 14px; }
    .input-field { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; width: 100%; max-width: 300px; }
    .save-btn { background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    .edit-btn { background: #0284c7; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 6px; }
    .danger-btn { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .data-table th, .data-table td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
  `]
})
export class BatchesComponent implements OnInit {
  private svc = inject(StudentService);
  private cdr = inject(ChangeDetectorRef);

  batches: string[] = [];
  newBatchName = '';
  loading = false;
  isAdmin = false;

  async ngOnInit() {
    this.isAdmin = await this.svc.isAdmin();
    await this.loadBatches();
  }

  async loadBatches() {
    this.loading = true;
    try {
      this.batches = await this.svc.getCustomBatches();
    } catch (e: any) {
      alert('Failed to load batches: ' + (e.message || e));
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async createBatch() {
    if (!this.newBatchName.trim()) {
      alert('Please enter a batch name');
      return;
    }
    const name = this.newBatchName.trim();
    if (this.batches.includes(name)) {
      alert('This batch already exists.');
      return;
    }

    try {
      await this.svc.addCustomBatch(name);
      this.newBatchName = '';
      await this.loadBatches();
    } catch (e: any) {
      alert('Failed to create batch: ' + (e.message || e));
    }
  }

  async editBatch(oldName: string) {
    const newName = prompt(`Edit batch name for "${oldName}":`, oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();

    if (this.batches.includes(trimmed)) {
      alert('A batch with this name already exists.');
      return;
    }

    try {
      // Delete old batch entry and insert new one
      await this.svc.deleteCustomBatch(oldName);
      await this.svc.addCustomBatch(trimmed);
      await this.loadBatches();
    } catch (e: any) {
      alert('Failed to update batch: ' + (e.message || e));
    }
  }

  async deleteBatch(name: string) {
    if (!confirm(`Are you sure you want to delete the batch "${name}"?`)) return;
    try {
      await this.svc.deleteCustomBatch(name);
      await this.loadBatches();
    } catch (e: any) {
      alert('Failed to delete batch: ' + (e.message || e));
    }
  }
}