import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { rideSeconds } from '../../../src/trains/motion.utils';
import { CYCLE_SECONDS, TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import { TrainService } from '../../../src/trains/trains.service';
import { goingOn, kmAt, layoversAt, passSeconds, rideOf, turnSecondsOf, withinCycle } from '../../../src/trains/trains.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { trackOf, trainRunOf } from '../../support/factories/trainRuns.utils';
import { tightestHeadway } from '../../support/trains.utils';

/** How a metro runs: what these routes are. */
const METRO = TRAIN_PROFILES.metro;

/**
 * How many trains a service shows at moments through two cycles.
 *
 * @param service - The trains.
 * @returns How many at each moment.
 */
const countsOf = (service: TrainService): number[] => Array.from({ length: 60 }, (_unused, moment) => service.placesAt(moment * 127).length);

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

describe('TrainService', () => {
  describe('on a network', () => {
    const facts = NetworkFacts.create(tinyNetwork());
    const service = engineOf(facts).trainService(engineOf(facts).timeline.cursorAt(Date.UTC(1935, 0, 1)));

    test("runs at least a train on each of a network's routes, and counts them", () => {
      expect(service.fleet).toBeGreaterThanOrEqual(service.routes.length);
    });

    test('says where each train is, on a route of the network, from the clock alone', () => {
      const places = service.placesAt(5);
      expect(places.length).toBeGreaterThan(0);
      expect(places.every(({ run, km }) => km >= 0 && km <= run.lengthKm)).toBe(true);
      expect(service.placesAt(5)).toEqual(places);
    });

    test('keeps trains apart on the track they share', () => {
      expect(tightestHeadway(service)).toBeGreaterThanOrEqual(METRO.closestSeconds - 1);
    });
  });

  describe('placesAt', () => {
    const service = new TrainService([trainRunOf([trackOf(0, 20)])]);
    const [route] = service.routes;
    const firstOut = route?.departures.out[0] ?? 0;
    const tripSeconds = route?.ride.seconds ?? 0;

    test('runs out along the route, then back the same way', () => {
      const headings = new Set(Array.from({ length: 30 }, (_unused, moment) => service.placesAt(moment * 101).map(({ heading }) => heading)).flat());
      expect(headings).toEqual(new Set([1, -1]));
    });

    test('stands a train at the end it has come to while it turns, never out of sight, every train counted', () => {
      expect(service.placesAt(firstOut + tripSeconds + 1)).toContainEqual({ run: route?.run, km: 20, heading: -1 });
      const counts = countsOf(service);
      expect(counts).toEqual(counts.map(() => service.fleet));
    });

    test('comes round each cycle to where it was, so it never jumps', () => {
      expect(service.placesAt(CYCLE_SECONDS + 7)).toEqual(service.placesAt(7));
      expect(service.placesAt(-CYCLE_SECONDS + 7)).toEqual(service.placesAt(7));
    });
  });

  describe('a loop', () => {
    test('runs both ways round at once, each way its own trains, every train counted', () => {
      const service = new TrainService([{ ...trainRunOf([trackOf(0, 20)], { ends: ['a', 'a'] }), stopsKm: [0, 20] }]);
      expect(new Set(service.placesAt(100).map(({ heading }) => heading))).toEqual(new Set([1, -1]));
      const counts = countsOf(service);
      expect(counts).toEqual(counts.map(() => service.fleet));
    });

    test('runs a line that is one way round only that way', () => {
      const service = new TrainService([{ ...trainRunOf([trackOf(0, 20)], { ends: ['a', 'a'] }), oneWay: true }]);
      expect(new Set(service.placesAt(100).map(({ heading }) => heading))).toEqual(new Set([1]));
      expect(service.routes[0]?.departures.back).toEqual([]);
    });
  });

  describe('an end routes share', () => {
    test("turns a line's trains where its routes end together, any taking the next train out there", () => {
      const service = new TrainService([trainRunOf([trackOf(0, 6)], { ends: ['z', 'a'] }), trainRunOf([trackOf(1, 9)], { ends: ['z', 'b'] })]);
      const leaving = service.routes.flatMap(({ departures }) => departures.out).toSorted((first, second) => first - second);
      let widest = 0;
      for (const [place, departure] of leaving.entries()) widest = Math.max(widest, (leaving[place + 1] ?? (leaving[0] ?? 0) + CYCLE_SECONDS) - departure);
      const atStart = service.routes.flatMap(({ layovers }) => layovers.filter(({ km }) => km === 0));
      expect(atStart).toHaveLength(leaving.length);
      expect(Math.max(...atStart.map(({ seconds }) => seconds))).toBeLessThanOrEqual(turnSecondsOf(service.routes[0]!.run) + widest);
      expect(service.routes.map(({ run }) => run.ends[0])).toEqual([stationId('z'), stationId('z')]);
    });
  });
});
