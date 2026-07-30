import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MeetingService } from '../../services/meeting';
import { MeetingToolbarComponent } from '../meeting-toolbar/meeting-toolbar';
import { MeetingChatComponent } from '../meeting-chat/meeting-chat';
import { MeetingParticipantsComponent } from '../meeting-participants/meeting-participants';
import { FloatingPlayerComponent } from '../floating-player/floating-player';

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

  onDragEnded(_e: CdkDragEnd): void {
    // CDK applies the transform automatically
  }

  toggleParticipants(): void {
    this.showParticipants = !this.showParticipants;
  }
}