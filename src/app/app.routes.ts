import { Routes } from '@angular/router';

// Component Imports
import { HomeComponent } from './components/home/home'; 
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { EventsComponent } from './components/events/events'; 
import { SessionReportComponent } from './pages/session-report/session-report';
import { MeetingsComponent } from './components/meetings/meetings';
import { AddMeetingComponent } from './components/add-meeting/add-meeting';
import { FundraisersComponent } from './components/fundraisers/fundraisers';
import { FundEntryComponent } from './components/fund-entry/fund-entry';
import { VolunteerComponent } from './components/volunteer/volunteer';
import { WeeklyTaskListComponent } from './components/weekly-task-list/weekly-task-list';
import { WeeklyTaskFormComponent } from './components/weekly-task-form/weekly-task-form';
import { SessionProgressComponent } from './pages/session-progress/session-progress';
import { UpdatePasswordComponent } from './pages/update-password/update-password';
import { VideoCallComponent } from './components/video-call/video-call';
// Guards
import { authGuard } from './guards/auth-guard';
import { guestGuard } from './guards/guest-guard';
import { adminGuard } from './guards/admin-guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  
  // Public routes
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'update-password', component: UpdatePasswordComponent },
  { path: 'session-progress', component: SessionProgressComponent },
  { path: 'volunteer', component: VolunteerComponent },
  
  // Protected Dashboard with Child Routes
  { 
    path: 'dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard],
    children: [
      { path: 'video-call', component: VideoCallComponent }
    ]
  },
  
  { path: 'events', component: EventsComponent, canActivate: [authGuard] },
  { path: 'session-report', component: SessionReportComponent, canActivate: [authGuard] },
  { path: 'session-report/:id', component: SessionReportComponent, canActivate: [authGuard] },
  { path: 'meetings', component: MeetingsComponent, canActivate: [authGuard] },
  { path: 'fundraisers', component: FundraisersComponent, canActivate: [authGuard] },
  
  // Weekly Tasks Routes
  { path: 'weekly-tasks', component: WeeklyTaskListComponent, canActivate: [authGuard] },
  { path: 'weekly-tasks/add', component: WeeklyTaskFormComponent, canActivate: [adminGuard] },
  { path: 'weekly-tasks/edit/:id', component: WeeklyTaskFormComponent, canActivate: [adminGuard] },
  
  // Admin-Only Routes
  { path: 'add-meeting', component: AddMeetingComponent, canActivate: [adminGuard] },
  { path: 'add-meeting/:id', component: AddMeetingComponent, canActivate: [adminGuard] },
  { path: 'fund-entry', component: FundEntryComponent, canActivate: [adminGuard] },
  
  { path: '**', redirectTo: '' }
];