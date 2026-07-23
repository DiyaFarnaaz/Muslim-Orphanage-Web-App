import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Fundraisers } from './fundraisers';

describe('Fundraisers', () => {
  let component: Fundraisers;
  let fixture: ComponentFixture<Fundraisers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Fundraisers],
    }).compileComponents();

    fixture = TestBed.createComponent(Fundraisers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
