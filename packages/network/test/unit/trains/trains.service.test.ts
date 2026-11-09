import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { CYCLE_SECONDS, TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import { TrainService } from '../../../src/trains/trains.service';
import { turnSecondsOf } from '../../../src/trains/trains.utils';
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
