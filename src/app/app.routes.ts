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
import { authGuard } from './guards/auth-guard';
import { guestGuard } from './guards/guest-guard';
// Guards

export const routes: Routes = [
  { path: '', component: HomeComponent },
  
  // Public routes protected against logged-in users
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  
  // Publicly visible route for everyone
  { path: 'volunteer', component: VolunteerComponent },
  
  // Protected Routes
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'events', component: EventsComponent, canActivate: [authGuard] },
  { path: 'session-report', component: SessionReportComponent, canActivate: [authGuard] },
  { path: 'meetings', component: MeetingsComponent, canActivate: [authGuard] },
  { path: 'add-meeting', component: AddMeetingComponent, canActivate: [authGuard] },
  { path: 'fundraisers', component: FundraisersComponent, canActivate: [authGuard] },
  { path: 'fund-entry', component: FundEntryComponent, canActivate: [authGuard] },
  
  { path: '**', redirectTo: '', pathMatch: 'full' }
];