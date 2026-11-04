import { describe, expect, test } from 'vitest';
import { recordedPageOf } from '../../../src/recorder/recordedPage.utils.ts';
import { TAIL_SECONDS } from '../../../src/recorder/recorder.constants.ts';

describe('RecordedPageUtils', () => {
  describe('recordedPageOf', () => {
    test("finds a city's video page under /video, and its explorer at its own address", () => {
      expect(recordedPageOf('video').pathOf('kyiv')).toBe('/video/kyiv');
      expect(recordedPageOf('explorer').pathOf('kyiv')).toBe('/kyiv');
    });

    test("ends the video page with its end card, the explorer a few seconds after it stops: the camera's move", () => {
      expect(recordedPageOf('video').tailSeconds).toBe(0);
      expect(recordedPageOf('explorer').tailSeconds).toBe(TAIL_SECONDS);
    });
  });
});
