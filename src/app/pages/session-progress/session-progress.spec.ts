import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionProgress } from './session-progress';

describe('SessionProgress', () => {
  let component: SessionProgress;
  let fixture: ComponentFixture<SessionProgress>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionProgress],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionProgress);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
