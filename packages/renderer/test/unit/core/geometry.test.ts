import { describe, expect, test } from 'vitest';
import type { LngLat } from '@railtime/schema/network.types';
import { boundsOf, cumulativeDistances, distanceKm, sliceAlong } from '../../../src/core/geometry.utils';

/** Km in a degree of longitude on the equator, where these tracks run. */
const KM_PER_DEGREE = 111.32;

/** A track along the equator: points at 0°, 0.01° and 0.03° east, its pieces about 1.1 and 2.2 km. */
const TRACK: LngLat[] = [
  [0, 0],
  [0.01, 0],
  [0.03, 0],
];

/**
 * Points rounded to a millionth of a degree, to compare: interpolated ones are a hair off.
 *
 * @param points - The points.
 * @returns Them rounded, `-0` as `0`.
 */
const rounded = (points: LngLat[]): LngLat[] => points.map(([longitude, latitude]) => [Number(longitude.toFixed(6)) + 0, Number(latitude.toFixed(6)) + 0]);

describe('GeometryUtils', () => {
  describe('distanceKm', () => {
    test('measures a degree of latitude the same anywhere', () => {
      expect(distanceKm([-0.1, 51], [-0.1, 52])).toBeCloseTo(110.57, 1);
      expect(distanceKm([-1.6, 54.5], [-1.6, 55.5])).toBeCloseTo(110.57, 1);
    });

    test('shrinks a degree of longitude with the latitude it is measured at', () => {
      // At 51.5° and 55° north: cos(51.5°) and cos(55°) of the 111.32 km at the equator.
      expect(distanceKm([-0.5, 51.5], [0.5, 51.5])).toBeCloseTo(69.3, 1);
      expect(distanceKm([-2, 55], [-1, 55])).toBeCloseTo(63.85, 1);
    });
  });

  describe('cumulativeDistances', () => {
    test('measures how far along the track each point lies, from 0 at the first', () => {
      const distances = cumulativeDistances(TRACK);
      expect(distances).toHaveLength(3);
      expect(distances[0]).toBe(0);
      expect(distances[1]).toBeCloseTo(0.01 * KM_PER_DEGREE, 6);
      expect(distances[2]).toBeCloseTo(0.03 * KM_PER_DEGREE, 6);
      expect(cumulativeDistances([])).toEqual([]);
      // Each point adds its own piece to the one before's total, however many there are.
      expect(cumulativeDistances([...TRACK, [0.06, 0]]).at(-1)).toBeCloseTo(0.06 * KM_PER_DEGREE, 6);
    });
  });

  describe('sliceAlong', () => {
    const distances = cumulativeDistances(TRACK);

    test('keeps the points up to a length, and ends on a point between two where it falls', () => {
      expect(rounded(sliceAlong(TRACK, distances, 0.02 * KM_PER_DEGREE))).toEqual([
        [0, 0],
        [0.01, 0],
        [0.02, 0],
      ]);
      expect(rounded(sliceAlong(TRACK, distances, 0.005 * KM_PER_DEGREE))).toEqual([
        [0, 0],
        [0.005, 0],
      ]);
    });

    test('ends on a point the length reaches exactly, adding none after it', () => {
      expect(rounded(sliceAlong(TRACK, distances, distances[1]!))).toEqual([
        [0, 0],
        [0.01, 0],
      ]);
    });

    test('keeps only the first point of none of it, and every point of more than all of it', () => {
      expect(sliceAlong(TRACK, distances, 0)).toEqual([[0, 0]]);
      expect(sliceAlong(TRACK, distances, 100)).toEqual(TRACK);
    });

    test('ends on a point between two in latitude too', () => {
      const north: LngLat[] = [
        [0, 0],
        [0, 0.02],
      ];
      expect(rounded(sliceAlong(north, cumulativeDistances(north), distanceKm([0, 0], [0, 0.01])))).toEqual([
        [0, 0],
        [0, 0.01],
      ]);
    });
  });

  describe('boundsOf', () => {
    test('boxes the points from their south-west to their north-east', () => {
      expect(
        boundsOf([
          [1, 5],
          [-2, 7],
          [3, -4],
        ]),
      ).toEqual([
        [-2, -4],
        [3, 7],
      ]);
      expect(boundsOf([[1, 2]])).toEqual([
        [1, 2],
        [1, 2],
      ]);
    });

    test('has no box without points', () => {
      expect(boundsOf([])).toBeNull();
    });
  });
});
