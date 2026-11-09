import { describe, expect, test } from 'vitest';
import { rideSeconds } from '../../../src/trains/motion.utils';
import { CYCLE_SECONDS, TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import { goingOn, kmAt, layoversAt, passSeconds, rideOf, turnSecondsOf, withinCycle } from '../../../src/trains/trains.utils';
import { trackOf, trainRunOf } from '../../support/factories/trainRuns.utils';

/** How a metro runs: what these routes are. */
const METRO = TRAIN_PROFILES.metro;

describe('TrainsUtils', () => {
  describe('rideOf', () => {
    test('rides from stop to stop, standing at each', () => {
      const { seconds, times, kms } = rideOf(trainRunOf([trackOf(0, 1)]));
      expect(seconds).toBeCloseTo(rideSeconds(METRO, 1) + 2 * METRO.standSeconds);
      expect(kms).toEqual([0, 0, 1, 1]);
      expect(times.at(-1)).toBe(seconds);
    });

    test('takes longer with more stops on the same track, as a stopping train does', () => {
      const route = trainRunOf([trackOf(0, 4)]);
      expect(rideOf({ ...route, stopsKm: [0, 1, 2, 3, 4] }).seconds).toBeGreaterThan(rideOf(route).seconds + 3 * METRO.standSeconds);
    });

    test('runs each kind of railway as it runs: a tram slower than a metro on the same track', () => {
      const route = trainRunOf([trackOf(0, 4)]);
      expect(rideOf({ ...route, mode: 'tram' }).seconds).toBeGreaterThan(rideOf(route).seconds);
    });

    test('stands once a lap at where a loop closes', () => {
      expect(rideOf(trainRunOf([trackOf(0, 4)], { ends: ['a', 'a'] })).seconds).toBeCloseTo(rideSeconds(METRO, 4) + METRO.standSeconds);
    });
  });

  describe('turnSecondsOf', () => {
    test('allows a train its turn at an end, less what it stands there in its ride, and none on a loop', () => {
      expect(turnSecondsOf(trainRunOf([trackOf(0, 1)]))).toBe(METRO.turnSeconds - 2 * METRO.standSeconds);
      expect(turnSecondsOf(trainRunOf([trackOf(0, 1)], { ends: ['a', 'a'] }))).toBe(0);
    });
  });

  describe('passSeconds', () => {
    const ride = rideOf({ ...trainRunOf([trackOf(0, 2)]), stopsKm: [1] });

    test('says when a train reaches a stop, and a point it passes on the way', () => {
      expect(passSeconds(ride, 1, 1)).toBeCloseTo(rideSeconds(METRO, 1));
      expect(passSeconds(ride, 0.5, 1)).toBeLessThan(rideSeconds(METRO, 1));
      expect(passSeconds(ride, 0.5, 1)).toBeGreaterThan(0);
    });

    test('says when one heading back reaches it, after it sets out back', () => {
      expect(passSeconds(ride, 1, -1)).toBeCloseTo(rideSeconds(METRO, 1));
    });
  });

  describe('kmAt', () => {
    const ride = rideOf({ ...trainRunOf([trackOf(0, 1)]), stopsKm: [] });

    test('gathers pace from a stop and loses it into the next', () => {
      expect(kmAt(ride, 15, 1)).toBeGreaterThan(kmAt(ride, 5, 1) * 3);
    });

    test('runs back the way it came out', () => {
      expect(kmAt(ride, 0, -1)).toBe(1);
      expect(kmAt(ride, 10, -1)).toBeCloseTo(1 - kmAt(ride, 10, 1));
    });
  });

  describe('withinCycle', () => {
    test('takes a time round the cycle, a clock behind its start as well as one ahead', () => {
      expect(withinCycle(CYCLE_SECONDS + 5)).toBe(5);
      expect(withinCycle(-5)).toBe(CYCLE_SECONDS - 5);
    });
  });

  describe('goingOn', () => {
    test('says how long ago something going on now began, more than once where it takes longer than a cycle', () => {
      expect(goingOn(100, 50, 60)).toEqual([50]);
      expect(goingOn(100, 50, 40)).toEqual([]);
      expect(goingOn(10, CYCLE_SECONDS - 10, 30)).toEqual([20]);
      expect(goingOn(100, 50, CYCLE_SECONDS + 60)).toEqual([50, CYCLE_SECONDS + 50]);
    });
  });

  describe('layoversAt', () => {
    const arrivals = [100, 1000].map((seconds, route) => ({ seconds, route, km: 0, heading: 1 as const }));

    test('sets each train coming in out on the next one ready to leave, first in first out', () => {
      const layovers = layoversAt({ arrivals, departures: [1200, 400], readySeconds: 60 });
      expect(layovers.map(({ route, layover }) => [route, layover.fromSeconds, layover.seconds])).toEqual([
        [0, 100, 300],
        [1, 1000, 200],
      ]);
    });

    test('waits a train for the next cycle where none sets out after it is ready', () => {
      const [layover] = layoversAt({ arrivals: [arrivals[0]!], departures: [120], readySeconds: 60 });
      expect(layover?.layover.seconds).toBe(CYCLE_SECONDS + 20);
    });
  });
});
