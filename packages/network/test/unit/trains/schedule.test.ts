import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import type { TrackSegment } from '../../../src/engine/engine.types';
import { rideSeconds } from '../../../src/trains/motion.utils';
import { passSeconds, placesOf, timetableOf, timetablesOf, trainsOn } from '../../../src/trains/schedule.utils';
import { TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import type { Heading, RouteTimetable, TrainRun } from '../../../src/trains/trains.types';

/** How a metro runs: what these routes are. */
const METRO = TRAIN_PROFILES.metro;

/** How long after one train the next comes, seconds, where it makes no odds. */
const EVERY = 300;

/**
 * A stretch of track.
 *
 * @param index - Its place among the network's.
 * @param lengthKm - How long it is.
 * @returns The stretch.
 */
const segmentOf = (index: number, lengthKm: number) => ({ index, lengthKm }) as TrackSegment;

/**
 * A route along stretches of track, stopping at each end.
 *
 * @param segments - Its stretches.
 * @param options - What else it is.
 * @param options.line - Its line.
 * @param options.ends - The stations it runs between.
 * @returns The route.
 */
const routeOf = (segments: TrackSegment[], { line = 'red', ends = ['a', 'b'] } = {}): TrainRun => {
  let lengthKm = 0;
  const legs = segments.map(segment => {
    const startKm = lengthKm;
    lengthKm += segment.lengthKm;
    return { segment, forward: true, startKm };
  });
  return { line: lineId(line), mode: 'metro', ends: [stationId(ends[0] ?? 'a'), stationId(ends[1] ?? 'b')], legs, lengthKm, stopsKm: [0, lengthKm] };
};

/**
 * When a route's trains enter a stretch, on the clock, each way.
 *
 * @param timetable - The route's timetable.
 * @param km - How far along it the stretch starts.
 * @param heading - Which way.
 * @returns How far into its beat.
 */
const beatAt = (timetable: RouteTimetable | undefined, km: number, heading: Heading): number => {
  const { everySeconds, phaseSeconds } = timetable!;
  const seconds = passSeconds(timetable!, km, heading) - phaseSeconds;
  return ((seconds % everySeconds) + everySeconds) % everySeconds;
};

describe('ScheduleUtils', () => {
  describe('timetableOf', () => {
    test('rides from stop to stop, standing at each', () => {
      const { tripSeconds, times, kms } = timetableOf(routeOf([segmentOf(0, 1)]), EVERY);
      expect(tripSeconds).toBeCloseTo(rideSeconds(METRO, 1) + 2 * METRO.standSeconds);
      expect(kms).toEqual([0, 0, 1, 1]);
      expect(times.at(-1)).toBe(tripSeconds);
    });

    test('takes longer with more stops on the same track, as a stopping train does', () => {
      const route = routeOf([segmentOf(0, 4)]);
      const stopping = timetableOf({ ...route, stopsKm: [0, 1, 2, 3, 4] }, EVERY);
      expect(stopping.tripSeconds).toBeGreaterThan(timetableOf(route, EVERY).tripSeconds + 3 * METRO.standSeconds);
    });

    test('runs each kind of railway as it runs: a tram slower than a metro on the same track', () => {
      const route = routeOf([segmentOf(0, 4)]);
      expect(timetableOf({ ...route, mode: 'tram' }, EVERY).tripSeconds).toBeGreaterThan(timetableOf(route, EVERY).tripSeconds);
    });

    test('allows a train its turn at each end, however often trains come', () => {
      const { backAfterSeconds, roundSeconds, tripSeconds } = timetableOf(routeOf([segmentOf(0, 40)]), EVERY);
      const standing = 2 * METRO.standSeconds;
      expect(backAfterSeconds - tripSeconds).toBeGreaterThanOrEqual(METRO.turnSeconds - standing);
      expect(roundSeconds - backAfterSeconds - tripSeconds).toBeGreaterThanOrEqual(METRO.turnSeconds - standing);
    });

    test('takes as many trains as a round over how often they come, a whole number', () => {
      const timetable = timetableOf(routeOf([segmentOf(0, 40)]), EVERY);
      expect(timetable.roundSeconds % EVERY).toBe(0);
      expect(trainsOn(timetable)).toBe(timetable.roundSeconds / EVERY);
    });

    test('stands once a lap at where a loop closes, with no turn in it', () => {
      const route = routeOf([segmentOf(0, 4)], { ends: ['a', 'a'] });
      const { tripSeconds, roundSeconds, backAfterSeconds } = timetableOf(route, EVERY);
      expect(tripSeconds).toBeCloseTo(rideSeconds(METRO, 4) + METRO.standSeconds);
      expect(backAfterSeconds).toBe(0);
      expect(roundSeconds).toBe(Math.ceil(tripSeconds / EVERY) * EVERY);
    });

    test('runs a loop each way with trains of its own', () => {
      const timetable = timetableOf(routeOf([segmentOf(0, 20)], { ends: ['a', 'a'] }), EVERY);
      expect(trainsOn(timetable)).toBe((timetable.roundSeconds / EVERY) * 2);
    });
  });

  describe('passSeconds', () => {
    const timetable = timetableOf({ ...routeOf([segmentOf(0, 2)]), stopsKm: [1] }, EVERY);

    test('says when a train reaches a stop, and a point it passes on the way', () => {
      expect(passSeconds(timetable, 1, 1)).toBeCloseTo(rideSeconds(METRO, 1));
      expect(passSeconds(timetable, 0.5, 1)).toBeLessThan(rideSeconds(METRO, 1));
      expect(passSeconds(timetable, 0.5, 1)).toBeGreaterThan(0);
    });

    test('says when one heading back reaches it, later in its round', () => {
      const heading = timetable.backAfterSeconds + timetable.tripSeconds;
      expect(passSeconds(timetable, 1, -1)).toBeCloseTo(heading - rideSeconds(METRO, 1) - METRO.standSeconds);
    });
  });

  describe('placesOf', () => {
    const timetable = timetableOf({ ...routeOf([segmentOf(0, 1)]), stopsKm: [] }, EVERY);
    const { tripSeconds, backAfterSeconds, roundSeconds, run } = timetable;

    test('runs out along the route, then back the same way', () => {
      expect(placesOf(timetable, tripSeconds / 2)).toContainEqual({ run, km: expect.closeTo(0.5) as number, heading: 1 });
      expect(placesOf(timetable, backAfterSeconds + tripSeconds / 2)).toContainEqual({ run, km: expect.closeTo(0.5) as number, heading: -1 });
    });

    test('has a train out of sight while it turns at an end, for the next to come in behind it', () => {
      const long = timetableOf({ ...routeOf([segmentOf(0, 1)]), stopsKm: [] }, 3600);
      expect(placesOf(long, long.tripSeconds + 1)).toEqual([]);
      expect(placesOf(long, long.roundSeconds - 1)).toEqual([]);
    });

    test('sets a train off from each end at the same moment', () => {
      const long = timetableOf({ ...routeOf([segmentOf(0, 30)]), stopsKm: [] }, EVERY);
      expect(placesOf(long, 0).map(({ km, heading }) => [km, heading])).toEqual(
        expect.arrayContaining([
          [0, 1],
          [30, -1],
        ]),
      );
    });

    test('runs a loop both ways round at once, and never takes a train out of sight', () => {
      const looped = timetableOf({ ...routeOf([segmentOf(0, 20)], { ends: ['a', 'a'] }), stopsKm: [0, 20] }, EVERY);
      const counts = Array.from({ length: 50 }, (_, moment) => placesOf(looped, moment * 97));
      expect(counts.map(places => places.length)).toEqual(counts.map(() => trainsOn(looped)));
      expect(new Set(counts[0]?.map(({ heading }) => heading))).toEqual(new Set([1, -1]));
    });

    test('runs a line that is one way round a loop only that way, in the half the trains', () => {
      const route = { ...routeOf([segmentOf(0, 20)], { ends: ['a', 'a'] }), oneWay: true as const };
      const oneWay = timetableOf(route, EVERY);
      expect(new Set(placesOf(oneWay, 100).map(({ heading }) => heading))).toEqual(new Set([1]));
      expect(trainsOn(oneWay)).toBe(oneWay.roundSeconds / EVERY);
    });

    test('carries a train on round a loop past where it closes, no jump between laps', () => {
      const looped = timetableOf({ ...routeOf([segmentOf(0, 20)], { ends: ['a', 'a'] }), stopsKm: [0, 20] }, EVERY);
      const train = (seconds: number) => placesOf({ ...looped, everySeconds: looped.roundSeconds }, seconds)[0];
      expect(train(looped.roundSeconds + 1)).toEqual(train(1));
      expect(train(looped.tripSeconds - 0.001)?.km).toBeCloseTo(20, 1);
    });

    test('comes round to where it was, so it never jumps', () => {
      expect(placesOf(timetable, roundSeconds + 1)).toEqual(placesOf(timetable, 1));
    });

    test('runs a clock behind its start as well as one ahead', () => {
      expect(placesOf({ ...timetable, phaseSeconds: -roundSeconds }, 1)).toEqual(placesOf(timetable, 1));
    });

    test('gathers pace from a stop and loses it into the next', () => {
      const [first, middle] = [
        placesOf({ ...timetable, everySeconds: roundSeconds }, 5)[0]?.km ?? 0,
        placesOf({ ...timetable, everySeconds: roundSeconds }, 15)[0]?.km ?? 0,
      ];
      expect(middle).toBeGreaterThan(first * 3);
    });
  });

  describe('timetablesOf', () => {
    const trunk = segmentOf(9, 10);

    test('runs a line that does not fork at its headway', () => {
      expect(timetablesOf([routeOf([trunk])]).map(({ everySeconds }) => everySeconds)).toEqual([METRO.headwaySeconds]);
    });

    test('keeps a headway whatever the size of the network: its fleet comes out of it', () => {
      const long = timetablesOf([routeOf([segmentOf(0, 100)])]);
      const short = timetablesOf([routeOf([segmentOf(0, 5)])]);
      expect(long[0]?.everySeconds).toBe(short[0]?.everySeconds);
      expect(trainsOn(long[0]!)).toBeGreaterThan(trainsOn(short[0]!) * 5);
    });

    test('adds two branches up along their trunk, but no closer than trains may come', () => {
      const forked = timetablesOf([routeOf([trunk, segmentOf(1, 2)]), routeOf([trunk, segmentOf(2, 2)])]);
      expect(forked.map(({ everySeconds }) => everySeconds)).toEqual([METRO.closestSeconds * 2, METRO.closestSeconds * 2]);
    });

    test("leaves a suburban line's branches their headway, adding up along their trunk", () => {
      const routes = [segmentOf(1, 2), segmentOf(2, 2), segmentOf(3, 2)].map(branch => ({ ...routeOf([trunk, branch]), mode: 'suburban-rail' as const }));
      expect(timetablesOf(routes).map(({ everySeconds }) => everySeconds)).toEqual(routes.map(() => TRAIN_PROFILES['suburban-rail'].headwaySeconds));
    });

    test('runs a line in two pieces as two services, neither thinned for the other', () => {
      const pieces = timetablesOf([routeOf([segmentOf(0, 5)]), routeOf([segmentOf(1, 5)], { ends: ['y', 'z'] })]);
      expect(pieces.map(({ everySeconds }) => everySeconds)).toEqual([METRO.headwaySeconds, METRO.headwaySeconds]);
    });

    test.each([2, 3, 4])('brings %s routes along a trunk in turn, evenly, each way', branches => {
      const routes = Array.from({ length: branches }, (_, place) => routeOf([trunk, segmentOf(place + 1, 1 + place)], { ends: ['a', `end${place}`] }));
      const timetables = timetablesOf(routes);
      const every = timetables[0]?.everySeconds ?? 0;
      const gaps = (heading: Heading) => {
        const beats = timetables.map(timetable => beatAt(timetable, heading === 1 ? 0 : trunk.lengthKm, heading)).toSorted((first, second) => first - second);
        return beats.map((beat, place) => (beats[place + 1] ?? (beats[0] ?? 0) + every) - beat);
      };
      expect(Math.min(...gaps(1))).toBeGreaterThan(every / branches - 1);
      expect(Math.min(...gaps(-1))).toBeGreaterThan(every / branches - 1);
    });

    test('leaves a route that shares nothing on its own clock', () => {
      expect(timetablesOf([routeOf([trunk])]).map(timetable => timetable.phaseSeconds)).toEqual([0]);
    });

    test('keeps each line to itself', () => {
      const lines = timetablesOf([routeOf([trunk]), routeOf([segmentOf(1, 3)], { line: 'blue' }), routeOf([segmentOf(2, 3)])]).map(({ run }) => run.line);
      expect(lines).toEqual([lineId('red'), lineId('red'), lineId('blue')]);
    });

    test('never has routes ending together reach their end at once', () => {
      const [first, second] = timetablesOf([routeOf([segmentOf(0, 8)], { ends: ['a', 'z'] }), routeOf([segmentOf(1, 8)], { ends: ['b', 'z'] })]);
      expect(Math.abs(beatAt(first, 8, 1) - beatAt(second, 8, 1))).toBeGreaterThan(1);
    });
  });
});
