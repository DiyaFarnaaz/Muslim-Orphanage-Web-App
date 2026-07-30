import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingService } from '../../services/meeting';

@Component({
  selector: 'app-floating-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-player.html',
  styleUrls: ['./floating-player.css']
})
export class FloatingPlayerComponent {
  constructor(public meeting: MeetingService) {}
}