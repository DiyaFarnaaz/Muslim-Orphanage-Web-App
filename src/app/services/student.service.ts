import { Injectable, inject } from '@angular/core';
import * as Papa from 'papaparse';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class StudentService {
  private supabase = inject(SupabaseService);

  classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  filterClasses = [...this.classes, 'Alumni'];   // Alumni = passed out after class 10
  genders = ['Boy', 'Girl'];

  private get db() { return this.supabase.client; }

  // ---------- helpers ----------
  nextClass(c: string): string | null {
    const i = this.classes.indexOf(c);
    if (i < 0) return null;
    return i === this.classes.length - 1 ? 'Alumni' : this.classes[i + 1];
  }

  private key(name: string, cls: string, gender: string) {
    return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${cls}|${gender}`;
  }

  downloadCsv(filename: string, rows: any[]) {
    const csv = '\ufeff' + Papa.unparse(rows);   // BOM so Excel reads special characters
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
    async isAdmin(): Promise<boolean> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) return false;
    const { data } = await this.db.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return (data?.role || '').toString().toLowerCase() === 'admin';
  }

  // ---------- students ----------
        async getStudents(cls: string, gender: string) {
    let q = this.db.from('students').select('*').order('name');
    q = cls === 'All' ? q.in('class', this.classes) : q.eq('class', cls);
    if (gender !== 'All') q = q.eq('gender', gender);
    const { data, error } = await q;
    if (error) throw error;
    const list = data || [];
    // class 1..10 in order, then by name
    return list.sort((a: any, b: any) =>
      (Number(a.class) || 99) - (Number(b.class) || 99) || a.name.localeCompare(b.name));
  }

  async getAllColumns() {
    const { data, error } = await this.db.from('mark_columns').select('*').order('created_at');
    if (error) throw error;
    return data || [];
  }

  /** Inserts only students that don't already exist (same name + class + gender). */
  async addStudentsUnique(rows: { name: string; class: string; gender: string }[]) {
    const existing = new Set<string>();
    for (const c of [...new Set(rows.map(r => r.class))]) {
      const list = await this.getStudents(c, 'All');
      list.forEach((s: any) => existing.add(this.key(s.name, s.class, s.gender)));
    }
    const fresh: typeof rows = [];
    let skipped = 0;
    for (const r of rows) {
      const k = this.key(r.name, r.class, r.gender);
      if (existing.has(k)) { skipped++; continue; }
      existing.add(k);
      fresh.push({ ...r, name: r.name.trim() });
    }
    if (fresh.length) {
      const { error } = await this.db.from('students').insert(fresh);
      if (error) throw error;
    }
    return { added: fresh.length, skipped };
  }

  async updateStudent(id: string, changes: { name: string; class: string; gender: string }) {
    const { error } = await this.db.from('students').update(changes).eq('id', id);
    if (error) throw error;
  }

  async deleteStudent(id: string) {
    const { error } = await this.db.from('students').delete().eq('id', id);
    if (error) throw error;
  }

  async promoteClass(from: string, to: string) {
    const { error } = await this.db.from('students').update({ class: to }).eq('class', from);
    if (error) throw error;
  }

  // ---------- marks ----------
  async getColumns(cls: string) {
    const { data, error } = await this.db.from('mark_columns').select('*')
      .eq('class', cls).order('created_at');
    if (error) throw error;
    return data || [];
  }

  async addColumn(cls: string, name: string, max_marks: number | null) {
    const { error } = await this.db.from('mark_columns').insert({ class: cls, name, max_marks });
    if (error) throw error;
  }

  async deleteColumn(id: string) {
    const { error } = await this.db.from('mark_columns').delete().eq('id', id);
    if (error) throw error;
  }

  async getMarks(studentIds: string[]) {
    if (!studentIds.length) return [];
    const { data, error } = await this.db.from('marks').select('*').in('student_id', studentIds);
    if (error) throw error;
    return data || [];
  }

  async saveMarks(rows: { student_id: string; column_id: string; value: number | null }[]) {
    const { error } = await this.db.from('marks')
      .upsert(rows, { onConflict: 'student_id,column_id' });
    if (error) throw error;
  }
}