import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MeetingService } from '../../services/meeting';
import { MeetingToolbarComponent } from '../meeting-toolbar/meeting-toolbar';
import { MeetingChatComponent } from '../meeting-chat/meeting-chat';
import { MeetingParticipantsComponent } from '../meeting-participants/meeting-participants';
import { FloatingPlayerComponent } from '../floating-player/floating-player';

/**
 * Drop this component ONCE in app.html, as a sibling of <router-outlet>,
 * e.g.:
 *
 *   <router-outlet></router-outlet>
 *   <app-meeting-overlay></app-meeting-overlay>
 *
 * Because it lives outside the router, Angular never destroys it on
 * navigation - the call, chat, and participants keep running no matter
 * what page the user is on. Full screen vs. floating is purely CSS driven
 * off MeetingService.mode(); nothing is torn out of the DOM to achieve it.
 */
@Component({
  selector: 'app-meeting-overlay',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    MeetingToolbarComponent,
    MeetingChatComponent,
    MeetingParticipantsComponent,
    FloatingPlayerComponent
  ],
  templateUrl: './meeting-overlay.html',
  styleUrls: ['./meeting-overlay.css']
})
export class MeetingOverlay implements AfterViewInit {
  @ViewChild('jitsiHost', { static: true }) jitsiHostRef!: ElementRef<HTMLElement>;
  @ViewChild('jitsiContainer', { static: true }) jitsiContainerRef!: ElementRef<HTMLElement>;

  showParticipants = false;

  constructor(public meeting: MeetingService) {}

  ngAfterViewInit(): void {
    this.meeting.registerHost(this.jitsiContainerRef.nativeElement, this.jitsiHostRef.nativeElement);
  }

  onWidgetClick(): void {
    // Single click anywhere on the floating widget's frame expands it back
    // to full screen. Toolbar/child components stopPropagation() on their
    // own clicks, and CDK drag only activates in floating mode, so this
    // never fires mid-drag or when clicking a button.
    if (this.meeting.mode() === 'floating') {
      this.meeting.expand();
    }
  }

  onDragEnded(_e: CdkDragEnd): void {
    // CDK applies the transform itself - nothing else needed here.
  }

  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
  }
}