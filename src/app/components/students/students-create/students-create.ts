import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as Papa from 'papaparse';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-students-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './students-create.html',
  styleUrls: ['../students.css']
})
export class StudentsCreateComponent {
  private svc = inject(StudentService);
  private router = inject(Router);

  classes = this.svc.classes;
  genders = this.svc.genders;

  form = { name: '', class: '1', gender: 'Boy' };
  saving = false;

  // CSV import
  importClass = 'All';
  csvRows: { name: string; gender: string; class?: string }[] = [];
  csvErrors: string[] = [];
  fileName = '';
  importing = false;

  get boysCount() { return this.csvRows.filter(r => r.gender === 'Boy').length; }
  get girlsCount() { return this.csvRows.filter(r => r.gender === 'Girl').length; }

  async createStudent() {
    if (!this.form.name.trim()) { alert('Enter student name'); return; }
    this.saving = true;
    try {
      const res = await this.svc.addStudentsUnique([{ ...this.form }]);
      if (res.skipped) { alert('This student already exists in this class.'); return; }
      this.router.navigate(['/dashboard/students/display'], {
        queryParams: { class: this.form.class, gender: this.form.gender }
      });
    } catch (e: any) {
      alert('Failed to create: ' + (e.message || e));
    } finally { this.saving = false; }
  }

  // ---------- CSV ----------
  downloadSample() {
    const csv = 'name,gender,class\nAhmed Khan,Boy,7\nFatima Begum,Girl,7\nYusuf Ali,Boy,8\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'students_sample.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    this.csvRows = [];
    this.csvErrors = [];
    if (!file) return;
    this.fileName = file.name;

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim().toLowerCase(),
      complete: (res) => {
        res.data.forEach((r: any, i: number) => {
          const name = (r['name'] || '').toString().trim();
          const g = this.normalizeGender(r['gender']);
          const rawClass = (r['class'] || '').toString().trim();
          const cls = rawClass ? rawClass.replace(/\D/g, '') : '';   // "7th" / "Class 7" -> "7"

          if (!name) { this.csvErrors.push(`Row ${i + 2}: name is missing`); return; }
          if (!g) { this.csvErrors.push(`Row ${i + 2}: gender must be Boy or Girl`); return; }
          if (rawClass && !this.classes.includes(cls)) {
            this.csvErrors.push(`Row ${i + 2}: class "${rawClass}" is not valid`); return;
          }
          this.csvRows.push({ name, gender: g, class: cls || undefined });
        });
      }
    });
  }

  private normalizeGender(v: any): string | null {
    const s = (v || '').toString().trim().toLowerCase();
    if (['boy', 'male', 'm', 'b'].includes(s)) return 'Boy';
    if (['girl', 'female', 'f', 'g'].includes(s)) return 'Girl';
    return null;
  }

  async importCsv() {
    if (!this.csvRows.length) { alert('No valid rows to import'); return; }

    const rows: { name: string; gender: string; class: string }[] = [];
    let missing = 0;
    for (const r of this.csvRows) {
      const cls = r.class || (this.importClass !== 'All' ? this.importClass : '');
      if (!cls) { missing++; continue; }
      rows.push({ name: r.name, gender: r.gender, class: cls });
    }
    if (missing) {
      alert(`${missing} row(s) have no class. Add a "class" column to the file or choose a single class.`);
      return;
    }

    this.importing = true;
    try {
      const res = await this.svc.addStudentsUnique(rows);
      alert(`${res.added} student(s) added, ${res.skipped} duplicate(s) skipped.`);
      this.router.navigate(['/dashboard/students/display'], {
        queryParams: { class: this.importClass, gender: 'All' }
      });
    } catch (e: any) {
      alert('Import failed: ' + (e.message || e));
    } finally { this.importing = false; }
  }
}