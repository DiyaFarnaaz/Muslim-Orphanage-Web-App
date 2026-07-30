import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingService } from '../../services/meeting';

@Component({
  selector: 'app-meeting-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-toolbar.html',
  styleUrls: ['./meeting-toolbar.css']
})
export class MeetingToolbarComponent {
  @Output() toggleParticipantsClick = new EventEmitter<void>();

  constructor(public meeting: MeetingService) {}

  async popOut(): Promise<void> {
    await this.meeting.requestExternalPiP();
  }

  leave(): void {
    this.meeting.leaveCall();
  }

  endForAll(): void {
    if (confirm('End this meeting for all participants?')) {
      this.meeting.endForAll();
    }
  }
}