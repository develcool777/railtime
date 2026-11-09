import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { arrivalSeconds, chaseAlong, frontKmAt, growthSeconds, mainPathOf, pointAlong } from '../../../src/steps/animation.utils';
import { stepAfter } from '../../support/stepFrames.utils';

/** 2 km a second, a second to reach it from a stop, a second at each station: 1 km to speed up, 1 to brake. */
const PACE = { kmPerSecond: 2, rampSeconds: 1, stationSeconds: 1 };
/**
 * Red's 1910 stretch, B – C – D, turned at C: D is 1 km north of C, not east.
 *
 * @returns The stretch's animation, its growth and the network it plays on.
 */
const cornered = () => {
  const network = tinyNetwork();
  const corner = network.stations[stationId('c')]!.coordinate;
  const north: [number, number] = [corner[0], corner[1] + 0.009];
  network.stations[stationId('d')]!.coordinate = north;
  network.segments[2]!.coordinates = [corner, north];
  const animation = stepAfter(network, '1905-01-01').animation;
  return { growth: animation.stretch!.growth, context: animation['context'] };
};

describe('StepAnimationUtils', () => {
  describe('growthSeconds', () => {
    test('takes each run at the pace, a ramp more for speeding up and braking, and a stop at each station', () => {
      // 6 km to a station: 3 s at the pace and 1 s of ramps, then 1 s there.
      expect(growthSeconds([6], 6, PACE)).toBe(5);
      // Twice as far, twice the time at the pace; the ramps and the stop the same.
      expect(growthSeconds([12], 12, PACE)).toBe(8);
      // Two stations: two runs, two stops.
      expect(growthSeconds([6, 12], 12, PACE)).toBe(10);
    });

    test('runs a stretch too short to reach the pace as a speeding up and a braking, and goes on past the last station', () => {
      // 2 km: speeding up for a second, braking for one, never at the pace for long; 1 km: half that distance, √2 s.
      expect(growthSeconds([2], 2, PACE)).toBeCloseTo(2 + PACE.stationSeconds);
      expect(growthSeconds([1], 1, PACE)).toBeCloseTo(Math.SQRT2 + PACE.stationSeconds);
      expect(growthSeconds([6], 12, PACE)).toBe(5 + 4);
    });
  });

  describe('arrivalSeconds', () => {
    test('gets to each stop after the runs and the waits before it', () => {
      // 6 km in 4 s; a second there; 6 km more in 4 s.
      expect(arrivalSeconds([6, 12], 12, PACE)).toEqual([4, 9]);
      expect(arrivalSeconds([], 12, PACE)).toEqual([]);
    });
  });

  describe('frontKmAt', () => {
    test('speeds up out of a stop, runs at the pace, and brakes into the next station, where it waits', () => {
      const frontAt = (seconds: number) => frontKmAt(seconds, [6], 6, PACE);
      expect(frontAt(0)).toBe(0);
      expect(frontAt(0.5)).toBeCloseTo(0.25);
      expect(frontAt(1)).toBeCloseTo(1);
      // At the pace: 2 km a second.
      expect(frontAt(2) - frontAt(1.5)).toBeCloseTo(1);
      expect(frontAt(3.5)).toBeCloseTo(6 - 0.25);
      expect(frontAt(4)).toBeCloseTo(6);
      expect(frontAt(4.5)).toBe(6);
    });

    test('moves alike on every stretch, short or long: the same speed a second out of a stop, and between', () => {
      const short = (seconds: number) => frontKmAt(seconds, [3], 3, PACE);
      const long = (seconds: number) => frontKmAt(seconds, [30], 30, PACE);
      expect(short(0.5)).toBeCloseTo(long(0.5));
      expect(short(1.2) - short(1.1)).toBeCloseTo(long(1.2) - long(1.1));
    });

    test("ends at the stretch's end, and waits first at a station where it starts", () => {
      expect(frontKmAt(100, [6], 12, PACE)).toBe(12);
      expect(frontKmAt(0.5, [0, 6], 6, PACE)).toBe(0);
      expect(frontKmAt(1.5, [0, 6], 6, PACE)).toBeCloseTo(0.25);
    });
  });

  describe('mainPathOf', () => {
    test('runs from where the stretch starts growing, each segment on from where the last ended', () => {
      const { growth } = stepAfter(tinyNetwork(), '1905-01-01').animation.stretch!;
      expect(mainPathOf(growth.plans).map(plan => [plan.segment.stationA, plan.segment.stationB])).toEqual([
        ['b', 'c'],
        ['c', 'd'],
      ]);
      expect(mainPathOf([])).toEqual([]);
    });
  });

  describe('pointAlong', () => {
    test('finds a point along the way, and its ends beyond them', () => {
      const { growth, context } = cornered();
      const path = mainPathOf(growth.plans);
      expect(pointAlong(path, 0)).toEqual(context.index.coordOf(stationId('b')));
      expect(pointAlong(path, -1)).toEqual(context.index.coordOf(stationId('b')));
      expect(pointAlong(path, 100)).toEqual(context.index.coordOf(stationId('d')));
      expect(pointAlong(path, path[0]!.segment.lengthKm)[0]).toBeCloseTo(context.index.coordOf(stationId('c'))[0], 9);
    });
  });

  describe('chaseAlong', () => {
    test('rounds a sharp bend: the camera sits inside it, facing from before it to past it', () => {
      const { growth, context } = cornered();
      const path = mainPathOf(growth.plans);
      const corner = context.index.coordOf(stationId('c'));
      const target = chaseAlong(path, path[0]!.segment.lengthKm);
      // Inside the corner: west of C, the way it came, and north, the way it goes.
      expect(target.center[0]).toBeLessThan(corner[0]);
      expect(target.center[1]).toBeGreaterThan(corner[1]);
      expect(target.behind[0]).toBeLessThan(corner[0]);
      expect(target.ahead[1]).toBeGreaterThan(corner[1]);
    });

    test('faces back the way it came for a front running backwards, as a closed stretch retracts', () => {
      const { growth, context } = cornered();
      const path = mainPathOf(growth.plans);
      const corner = context.index.coordOf(stationId('c'));
      const target = chaseAlong(path, path[0]!.segment.lengthKm, true);
      // From past the corner, north, towards before it, west.
      expect(target.behind[1]).toBeGreaterThan(corner[1]);
      expect(target.ahead[0]).toBeLessThan(corner[0]);
    });

    test('sits on the front itself where the stretch starts and ends', () => {
      const { growth, context } = cornered();
      const path = mainPathOf(growth.plans);
      expect(chaseAlong(path, 0).center).toEqual(context.index.coordOf(stationId('b')));
      expect(chaseAlong(path, 100).center).toEqual(context.index.coordOf(stationId('d')));
    });
  });
});
