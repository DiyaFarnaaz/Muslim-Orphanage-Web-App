import { TestBed } from '@angular/core/testing';

import { VideoCallState } from './video-call-state';

describe('VideoCallState', () => {
  let service: VideoCallState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VideoCallState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
