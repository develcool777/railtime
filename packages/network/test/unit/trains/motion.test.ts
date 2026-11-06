import { describe, expect, test } from 'vitest';
import { rideKmAt, rideSeconds, rideSecondsTo } from '../../../src/trains/motion.utils';
import type { TrainProfile } from '../../../src/trains/trains.types';

/** A train reaching 36 km/h, 10 m/s, in 10 seconds and 50 metres. */
const PROFILE: TrainProfile = { topKmh: 36, rateMetresPerSecondSquared: 1, standSeconds: 0, turnSeconds: 0, headwaySeconds: 60, closestSeconds: 60 };

describe('MotionUtils', () => {
  describe('rideSeconds', () => {
    test('pulls away, holds its top speed and brakes, on a stretch long enough', () => {
      expect(rideSeconds(PROFILE, 1)).toBeCloseTo(10 + 90 + 10);
    });

    test('brakes before reaching it, on a short one', () => {
      expect(rideSeconds(PROFILE, 0.025)).toBeCloseTo(2 * 5);
    });

    test('takes longer than the same way at top speed, as stops do', () => {
      expect(rideSeconds(PROFILE, 0.5)).toBeGreaterThan(0.5 / (PROFILE.topKmh / 3600));
    });
  });

  describe('rideKmAt', () => {
    test('moves slowly at first, fast between, and slowly again', () => {
      expect(rideKmAt(PROFILE, 1, 0)).toBeCloseTo(0);
      expect(rideKmAt(PROFILE, 1, 10)).toBeCloseTo(0.05);
      expect(rideKmAt(PROFILE, 1, 55)).toBeCloseTo(0.5);
      expect(rideKmAt(PROFILE, 1, 100)).toBeCloseTo(0.95);
      expect(rideKmAt(PROFILE, 1, 110)).toBeCloseTo(1);
    });

    test('never runs backwards', () => {
      const places = Array.from({ length: 111 }, (_, second) => rideKmAt(PROFILE, 1, second));
      expect(places).toEqual(places.toSorted((first, second) => first - second));
    });

    test('is the same ride backwards as forwards, so a train back runs as one out', () => {
      expect(rideKmAt(PROFILE, 1, 7)).toBeCloseTo(1 - rideKmAt(PROFILE, 1, 110 - 7));
    });
  });

  describe('rideSecondsTo', () => {
    test.each([0, 0.01, 0.05, 0.5, 0.97, 1])('says when a train reaches %s km, as `rideKmAt` puts it there', km => {
      expect(rideKmAt(PROFILE, 1, rideSecondsTo(PROFILE, 1, km))).toBeCloseTo(km);
    });
  });
});
