import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-students-display',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './students-display.html',
  styleUrls: ['../students.css']
})
export class StudentsDisplayComponent implements OnInit {
  private svc = inject(StudentService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  baseClasses = this.svc.filterClasses; // Classes 1-10 + Alumni
  customBatches: string[] = [];
  genders = this.svc.genders;

  isAdmin = false;
  selectedClass = '1';
  gender = 'All';
  search = '';
  students: any[] = [];
  loading = false;

  editingId: string | null = null;
  editData: any = {};

  // Combine base classes and custom batches into one dropdown list
  get allDropdownClasses() {
    return [...this.baseClasses, ...this.customBatches];
  }

  async ngOnInit() {
    this.isAdmin = await this.svc.isAdmin();
    this.customBatches = await this.svc.getCustomBatches();
    
    const q = this.route.snapshot.queryParamMap;
    this.selectedClass = q.get('class') || '1';
    this.gender = q.get('gender') || 'All';
    await this.load();
  }

  get filtered() {
    const q = this.search.trim().toLowerCase();
    return q ? this.students.filter(s => s.name.toLowerCase().includes(q)) : this.students;
  }
  get boys() { return this.students.filter(s => s.gender === 'Boy').length; }
  get girls() { return this.students.filter(s => s.gender === 'Girl').length; }
  get nextClass() { return this.svc.nextClass(this.selectedClass); }

  async load() {
    this.loading = true;
    this.editingId = null;
    try {
      // If the selectedClass is a custom batch, pass it as the batch filter; otherwise as class filter
      const isBatch = this.customBatches.includes(this.selectedClass);
      this.students = await this.svc.getStudents(
        isBatch ? 'All' : this.selectedClass, 
        this.gender, 
        isBatch ? this.selectedClass : undefined
      );
    } catch (e: any) {
      alert('Failed to load students: ' + (e.message || e));
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  startEdit(s: any) {
    if (!this.isAdmin) return;
    this.editingId = s.id;
    this.editData = { 
      name: s.name, 
      class: s.class, 
      gender: s.gender,
      batchesArray: (s.batches || '').split(',').map((b: string) => b.trim()).filter(Boolean)
    };
  }

  cancelEdit() { this.editingId = null; }

  toggleBatchSelection(batch: string) {
    const idx = this.editData.batchesArray.indexOf(batch);
    if (idx > -1) {
      this.editData.batchesArray.splice(idx, 1);
    } else {
      this.editData.batchesArray.push(batch);
    }
  }

  async saveEdit() {
    if (!this.isAdmin) return;
    if (!this.editData.name?.trim()) { alert('Name cannot be empty'); return; }
    try {
      const batchString = this.editData.batchesArray.join(', ');
      await this.svc.updateStudent(this.editingId!, {
        name: this.editData.name.trim(),
        class: this.editData.class,
        gender: this.editData.gender,
        batches: batchString
      });
      await this.load();
    } catch (e: any) { alert('Failed to update: ' + (e.message || e)); }
  }

  async remove(s: any) {
    if (!this.isAdmin) return;
    if (!confirm(`Delete ${s.name}?`)) return;
    try {
      await this.svc.deleteStudent(s.id);
      await this.load();
    } catch (e: any) { alert(e.message || e); }
  }

  async promote() {
    if (!this.isAdmin) return;
    const next = this.nextClass;
    if (!next) return;
    try {
      const all = await this.svc.getStudents(this.selectedClass, 'All');
      if (!all.length) { alert('No students in this class'); return; }
      const label = next === 'Alumni' ? 'Alumni (passed out)' : 'Class ' + next;
      if (!confirm(`Move all ${all.length} students of Class ${this.selectedClass} to ${label}?`)) return;
      await this.svc.promoteClass(this.selectedClass, next);
      this.selectedClass = next;
      this.gender = 'All';
      await this.load();
    } catch (e: any) { alert('Promotion failed: ' + (e.message || e)); }
  }

  exportCsv() {
    if (!this.isAdmin) return;
    if (!this.filtered.length) { alert('Nothing to export'); return; }
    const rows = this.filtered.map(s => ({ name: s.name, gender: s.gender, class: s.class, batches: s.batches }));
    this.svc.downloadCsv(`students_export_${this.selectedClass}.csv`, rows);
  }
}