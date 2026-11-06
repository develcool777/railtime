import { describe, expect, test } from 'vitest';
import { samePair, splitTrack } from '../../../src/plan/track.utils';
import { stationId } from '../../support/ids.utils';

describe('TrackUtils', () => {
  describe('samePair', () => {
    const [stationA, stationB, other] = [stationId('a'), stationId('b'), stationId('c')];

    test('takes two stations for the same pair either way round', () => {
      expect(samePair({ stationA, stationB }, { stationA, stationB })).toBe(true);
      expect(samePair({ stationA, stationB }, { stationA: stationB, stationB: stationA })).toBe(true);
    });

    test('tells apart pairs sharing one station', () => {
      expect(samePair({ stationA, stationB }, { stationA, stationB: other })).toBe(false);
      expect(samePair({ stationA, stationB }, { stationA: stationB, stationB: other })).toBe(false);
    });
  });

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
