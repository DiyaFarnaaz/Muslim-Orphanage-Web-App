import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyTaskForm } from './weekly-task-form';

describe('WeeklyTaskForm', () => {
  let component: WeeklyTaskForm;
  let fixture: ComponentFixture<WeeklyTaskForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyTaskForm],
    }).compileComponents();

    fixture = TestBed.createComponent(WeeklyTaskForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
