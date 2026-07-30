import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingService } from '../../services/meeting';

@Component({
  selector: 'app-meeting-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './meeting-chat.html',
  styleUrls: ['./meeting-chat.css']
})
export class MeetingChatComponent {
  input = '';

  constructor(public meeting: MeetingService) {}

  send(): void {
    if (!this.input.trim()) return;
    this.meeting.sendChatMessage(this.input);
    this.input = '';
  }
}