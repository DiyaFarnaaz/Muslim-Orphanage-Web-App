import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeeklyTaskList } from './weekly-task-list';

describe('WeeklyTaskList', () => {
  let component: WeeklyTaskList;
  let fixture: ComponentFixture<WeeklyTaskList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeeklyTaskList],
    }).compileComponents();

    fixture = TestBed.createComponent(WeeklyTaskList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
