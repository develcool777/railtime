import { describe, expect, test } from 'vitest';
import { splitTrack } from '../../../src/plan/track.utils';

describe('TrackUtils', () => {
  describe('splitTrack', () => {
    test('splits a track at its point nearest a point beside it', () => {
      expect(
        splitTrack(
          [
            [0, 0],
            [2, 0],
          ],
          [1, 1],
        ),
      ).toEqual([
        [
          [0, 0],
          [1, 0],
        ],
        [
          [1, 0],
          [2, 0],
        ],
      ]);
    });

    test('takes the first of two stretches as near as each other', () => {
      expect(
        splitTrack(
          [
            [0, 0],
            [1, 1],
            [2, 0],
          ],
          [1, 2],
        )[0],
      ).toEqual([
        [0, 0],
        [1, 1],
      ]);
    });

    test('takes the nearest of several stretches, past a repeated point', () => {
      expect(
        splitTrack(
          [
            [0, 0],
            [0, 0],
            [2, 0],
            [2, 2],
          ],
          [3, 1],
        ),
      ).toEqual([
        [
          [0, 0],
          [0, 0],
          [2, 0],
          [2, 1],
        ],
        [
          [2, 1],
          [2, 2],
        ],
      ]);
    });
  });
});
