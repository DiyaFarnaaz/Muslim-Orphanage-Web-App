import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeetingOverlay } from './meeting-overlay';

describe('MeetingOverlay', () => {
  let component: MeetingOverlay;
  let fixture: ComponentFixture<MeetingOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(MeetingOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
