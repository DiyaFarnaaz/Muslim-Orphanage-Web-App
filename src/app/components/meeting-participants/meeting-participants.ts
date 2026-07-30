import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingService } from '../../services/meeting';

@Component({
  selector: 'app-meeting-participants',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './meeting-participants.html',
  styleUrls: ['./meeting-participants.css']
})
export class MeetingParticipantsComponent {
  @Output() closePanel = new EventEmitter<void>();

  constructor(public meeting: MeetingService) {}
}