import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Volunteer } from './volunteer';

describe('Volunteer', () => {
  let component: Volunteer;
  let fixture: ComponentFixture<Volunteer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Volunteer],
    }).compileComponents();

    fixture = TestBed.createComponent(Volunteer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
