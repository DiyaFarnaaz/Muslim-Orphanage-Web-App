import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Meetings } from './meetings';

describe('Meetings', () => {
  let component: Meetings;
  let fixture: ComponentFixture<Meetings>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Meetings],
    }).compileComponents();

    fixture = TestBed.createComponent(Meetings);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
