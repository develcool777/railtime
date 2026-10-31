import { describe, expect, test } from 'vitest';
import { metresBetween, splitTrack } from '../../../src/core/geometry.utils';

describe('GeometryUtils', () => {
  describe('metresBetween', () => {
    test('measures a degree of latitude as about 111 km, and one of longitude shorter away from the equator', () => {
      expect(metresBetween([0, 51.5], [0, 51.501])).toBeCloseTo(111.3, 0);
      expect(metresBetween([0, 51.5], [0.001, 51.5])).toBeCloseTo(69.3, 0);
      expect(metresBetween([0, 51.5], [0, 51.5])).toBe(0);
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
