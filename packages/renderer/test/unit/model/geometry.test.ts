import { describe, expect, test } from 'vitest';
import { distanceKm } from '../../../src/model/geometry.utils';

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
});
