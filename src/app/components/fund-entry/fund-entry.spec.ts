import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FundEntry } from './fund-entry';

describe('FundEntry', () => {
  let component: FundEntry;
  let fixture: ComponentFixture<FundEntry>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FundEntry],
    }).compileComponents();

    fixture = TestBed.createComponent(FundEntry);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
