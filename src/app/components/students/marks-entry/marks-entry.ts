import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Papa from 'papaparse';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-marks-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marks-entry.html',
  styleUrls: ['../students.css']
})
export class MarksEntryComponent implements OnInit {
  private svc = inject(StudentService);
  private cdr = inject(ChangeDetectorRef);

  classes = this.svc.classes;
  isAdmin = false;
  selectedClass = '1';
  gender = 'All';
  search = '';

  students: any[] = [];
  columns: any[] = [];
  marks: { [studentId: string]: { [columnId: string]: number | null } } = {};

  newColName = '';
  newColMax: number | null = null;
  loading = false;
  saving = false;

  async ngOnInit() {
    this.isAdmin = await this.svc.isAdmin();
    await this.load();
  }

  get isAll() { return this.selectedClass === 'All'; }

  /** volunteers, and everyone in All Classes view, get the read-only table */
  get readOnly() { return !this.isAdmin || this.isAll; }

  get filteredStudents() {
    const q = this.search.trim().toLowerCase();
    return q ? this.students.filter(s => s.name.toLowerCase().includes(q)) : this.students;
  }

  /** unique column names (used in the read-only table) */
  get allHeaders(): string[] {
    return [...new Set(this.columns.map(c => c.name as string))];
  }

  /** mark of a student for the column with this name in the student's own class */
  cell(s: any, name: string) {
    const col = this.columns.find(c => c.class === s.class && c.name === name);
    if (!col) return '';
    const v = this.marks[s.id]?.[col.id];
    return v === null || v === undefined ? '' : v;
  }

  async load() {
    this.loading = true;
    try {
      this.students = await this.svc.getStudents(this.selectedClass, this.gender);
      this.columns = this.isAll
        ? await this.svc.getAllColumns()
        : await this.svc.getColumns(this.selectedClass);
      const saved = await this.svc.getMarks(this.students.map(s => s.id));
      this.marks = {};
      this.students.forEach(s => (this.marks[s.id] = {}));
      saved.forEach((m: any) => {
        if (this.marks[m.student_id]) this.marks[m.student_id][m.column_id] = m.value;
      });
    } catch (e: any) {
      alert('Failed to load: ' + (e.message || e));
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  async addColumn() {
    if (!this.isAdmin) return;
    if (this.isAll) { alert('Select a single class to add a column.'); return; }
    const name = this.newColName.trim();
    if (!name) { alert('Enter column name'); return; }
    if (['name', 'gender', 'class'].includes(name.toLowerCase())) {
      alert('"name", "gender" and "class" are reserved, choose another column name'); return;
    }
    try {
      await this.svc.addColumn(this.selectedClass, name, this.newColMax);
      this.newColName = '';
      this.newColMax = null;
      await this.load();
    } catch (e: any) {
      alert('Could not add column (name may already exist): ' + (e.message || e));
    }
  }

  async deleteColumn(col: any) {
    if (!this.isAdmin) return;
    if (!confirm(`Delete column "${col.name}" and all its marks?`)) return;
    try {
      await this.svc.deleteColumn(col.id);
      await this.load();
    } catch (e: any) { alert(e.message || e); }
  }

  total(studentId: string): number {
    const row = this.marks[studentId] || {};
    return this.columns.reduce((sum, c) => sum + (Number(row[c.id]) || 0), 0);
  }

  async save() {
    if (!this.isAdmin) return;
    if (this.isAll) { alert('Select a single class to save marks.'); return; }
    const rows: any[] = [];
    for (const s of this.students) {
      for (const c of this.columns) {
        const v = this.marks[s.id]?.[c.id];
        if (v === undefined) continue;
        const num = v === null || (v as any) === '' ? null : Number(v);
        if (num !== null && c.max_marks && num > c.max_marks) {
          alert(`${s.name}: ${num} is more than max marks (${c.max_marks}) for "${c.name}"`);
          return;
        }
        rows.push({ student_id: s.id, column_id: c.id, value: num });
      }
    }
    if (!rows.length) { alert('Nothing to save'); return; }
    this.saving = true;
    try {
      await this.svc.saveMarks(rows);
      alert('Marks saved successfully!');
    } catch (e: any) {
      alert('Failed to save: ' + (e.message || e));
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }

  // ---------- export (admin only) ----------
  exportCsv() {
    if (!this.isAdmin) return;
    if (!this.students.length) { alert('No students to export'); return; }
    let rows: any[];
    if (this.isAll) {
      rows = this.students.map(s => {
        const r: any = { class: s.class, name: s.name, gender: s.gender };
        this.allHeaders.forEach(h => (r[h] = this.cell(s, h)));
        return r;
      });
    } else {
      rows = this.students.map(s => {
        const r: any = { name: s.name, gender: s.gender };
        this.columns.forEach(c => (r[c.name] = this.marks[s.id]?.[c.id] ?? ''));
        return r;
      });
    }
    this.svc.downloadCsv(`marks_${this.isAll ? 'all_classes' : 'class_' + this.selectedClass}.csv`, rows);
  }

  // ---------- import (admin only) ----------
  importMarks(event: any) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.isAdmin) { input.value = ''; return; }
    if (!this.isAll && !this.columns.length) {
      alert('Create the mark columns first, then import.');
      input.value = '';
      return;
    }

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: async (res) => {
        try {
          await this.processImport(res);
        } catch (e: any) {
          alert('Import failed: ' + (e.message || e));
        } finally {
          input.value = '';
          this.cdr.detectChanges();
        }
      }
    });
  }

  private async processImport(res: Papa.ParseResult<any>) {
    // always import against the whole class / all classes, not just a filtered gender
    if (this.gender !== 'All') { this.gender = 'All'; await this.load(); }

    const norm = (v: any) => (v || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
    const headers = res.meta.fields || [];
    const find = (n: string) => headers.find(h => h.toLowerCase() === n);
    const nameH = find('name');
    const genderH = find('gender');
    const classH = find('class');

    if (!nameH) { alert('The file needs a "name" column.'); return; }
    if (this.isAll && !classH) { alert('For All Classes the file needs a "class" column.'); return; }

    const markHeaders = headers.filter(h => h !== nameH && h !== genderH && h !== classH);
    if (!markHeaders.length) { alert('The file has no mark columns.'); return; }

    const errors: string[] = [];
    const entries: { s: any; cls: string; h: string; num: number }[] = [];
    let matched = 0;

    // 1) match rows to students and read the numbers
    res.data.forEach((row: any, i: number) => {
      const nm = norm(row[nameH]);
      if (!nm) return;

      let cls = this.selectedClass;
      if (this.isAll) {
        cls = (row[classH!] ?? '').toString().replace(/\D/g, '');
        if (!this.classes.includes(cls)) {
          errors.push(`Row ${i + 2}: class "${row[classH!]}" is not valid`);
          return;
        }
      }

      let cands = this.students.filter(s => s.class === cls && norm(s.name) === nm);
      if (cands.length > 1 && genderH) {
        const g = norm(row[genderH]);
        const byG = cands.filter(s => g && s.gender[0].toLowerCase() === g[0]);
        if (byG.length) cands = byG;
      }
      if (cands.length === 0) { errors.push(`Row ${i + 2}: "${row[nameH]}" not found in Class ${cls}`); return; }
      if (cands.length > 1) { errors.push(`Row ${i + 2}: "${row[nameH]}" matches more than one student`); return; }

      const s = cands[0];
      matched++;
      markHeaders.forEach(h => {
        const raw = (row[h] ?? '').toString().trim();
        if (raw === '') return;
        const num = Number(raw);
        if (isNaN(num)) { errors.push(`Row ${i + 2}: "${raw}" is not a number for ${h}`); return; }
        entries.push({ s, cls, h, num });
      });
    });

    // 2) find which mark columns don't exist yet
    const colFor = (cls: string, h: string) =>
      this.columns.find(c => c.class === cls && c.name.toLowerCase() === h.toLowerCase());

    const missing = new Map<string, { cls: string; h: string }>();
    entries.forEach(e => {
      if (!colFor(e.cls, e.h)) missing.set(`${e.cls}|${e.h.toLowerCase()}`, { cls: e.cls, h: e.h });
    });

    const ignored = new Set<string>();
    if (missing.size) {
      const first = [...missing.values()][0];
      if (this.isAll && confirm(
        `${missing.size} mark column(s) don't exist yet (for example "${first.h}" in Class ${first.cls}).\n\nCreate them now?`)) {
        for (const m of missing.values()) {
          try { await this.svc.addColumn(m.cls, m.h, null); } catch { /* already exists */ }
        }
        this.columns = await this.svc.getAllColumns();
      } else {
        missing.forEach(m => ignored.add(m.h));
      }
    }

    // 3) apply the marks
    const toSave: { student_id: string; column_id: string; value: number }[] = [];
    entries.forEach(e => {
      const col = colFor(e.cls, e.h);
      if (!col) return;
      if (col.max_marks && e.num > col.max_marks) {
        errors.push(`${e.s.name}: ${e.num} is above max ${col.max_marks} for ${col.name}`);
        return;
      }
      if (this.isAll) toSave.push({ student_id: e.s.id, column_id: col.id, value: e.num });
      else this.marks[e.s.id][col.id] = e.num;
    });

    let msg: string;
    if (this.isAll) {
      if (toSave.length) await this.svc.saveMarks(toSave);
      await this.load();
      msg = `${matched} student(s) matched, ${toSave.length} mark(s) saved.`;
    } else {
      msg = `${matched} student(s) filled in the table. Click "Save Marks" to store them.`;
    }
    if (ignored.size) msg += `\nIgnored columns (not created): ${[...ignored].join(', ')}`;
    if (errors.length) {
      msg += `\n\nProblems:\n` + errors.slice(0, 10).join('\n') +
        (errors.length > 10 ? `\n...and ${errors.length - 10} more` : '');
    }
    alert(msg);
  }
}