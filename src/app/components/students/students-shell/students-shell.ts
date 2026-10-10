import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { StudentService } from '../../../services/student.service';

@Component({
  selector: 'app-students-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
    template: `
    <h2>Students</h2>
    <nav class="tabs">
      <a routerLink="display" routerLinkActive="active">Display Students</a>
      <a *ngIf="isAdmin" routerLink="create" routerLinkActive="active">Create Students</a>
      <a routerLink="marks" routerLinkActive="active">Marks Entry</a>
    </nav>
    <router-outlet></router-outlet>
  `,
  styleUrls: ['../students.css']
})
export class StudentsShellComponent implements OnInit {
  private svc = inject(StudentService);
  private cdr = inject(ChangeDetectorRef);
  isAdmin = false;

  async ngOnInit() {
    this.isAdmin = await this.svc.isAdmin();
    this.cdr.detectChanges();
  }
}