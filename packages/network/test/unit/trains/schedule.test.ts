import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import type { TrackSegment } from '../../../src/engine/engine.types';
import { intervalOf, passSeconds, placesOf, timetableOf, timetablesOf } from '../../../src/trains/schedule.utils';
import { TRAIN_FLEET, TRAIN_KM_PER_SECOND, TRAIN_LEAST_SPACING_KM, TRAIN_STOP_SECONDS } from '../../../src/trains/trains.constants';
import type { TrainRun } from '../../../src/trains/trains.types';

/** How long after one train the next comes, seconds, where it makes no odds. */
const EVERY = 60;

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
  return { line: lineId(line), ends: [stationId(ends[0] ?? 'a'), stationId(ends[1] ?? 'b')], legs, lengthKm, stopsKm: [0, lengthKm] };
};

describe('ScheduleUtils', () => {
  describe('intervalOf', () => {
    test('spaces a small network by the least spacing', () => {
      expect(intervalOf([[routeOf([segmentOf(0, 10)])]])).toBeCloseTo(TRAIN_LEAST_SPACING_KM / TRAIN_KM_PER_SECOND);
    });

    test('spaces a large one further apart, to carry about a fleet', () => {
      const km = TRAIN_FLEET * TRAIN_LEAST_SPACING_KM * 2;
      expect(intervalOf([[routeOf([segmentOf(0, km)])]])).toBeCloseTo((km * 2) / TRAIN_FLEET / TRAIN_KM_PER_SECOND);
    });

    test('counts track two routes of a line share once, and two lines share twice', () => {
      const big = segmentOf(0, TRAIN_FLEET * TRAIN_LEAST_SPACING_KM * 2);
      const forked = intervalOf([[routeOf([big]), routeOf([big])]]);
      const twoLines = intervalOf([[routeOf([big])], [routeOf([big], { line: 'blue' })]]);
      expect(twoLines).toBeCloseTo(forked * 2);
    });
  });

  describe('timetableOf', () => {
    test('rides at an even pace, and stands at each stop', () => {
      const { tripSeconds, times, kms } = timetableOf(routeOf([segmentOf(0, 1)]), EVERY);
      expect(tripSeconds).toBeCloseTo(1 / TRAIN_KM_PER_SECOND + 2 * TRAIN_STOP_SECONDS);
      expect(kms).toEqual([0, 0, 0, 1, 1, 1]);
      expect(times.at(-1)).toBe(tripSeconds);
    });

    test('makes each way a whole number of trains, so a train leaves each end together', () => {
      const long = timetableOf(routeOf([segmentOf(0, 40)]), EVERY);
      expect(long.wayIncludingTurnSeconds % EVERY).toBe(0);
      expect(long.wayIncludingTurnSeconds).toBeGreaterThanOrEqual(long.tripSeconds);
      expect(long.roundSeconds).toBe(long.wayIncludingTurnSeconds * 2);
    });

    test('runs a train each way on the shortest', () => {
      expect(timetableOf(routeOf([segmentOf(0, 0.5)]), EVERY).roundSeconds).toBe(EVERY * 2);
    });
  });

  describe('passSeconds', () => {
    const timetable = timetableOf({ ...routeOf([segmentOf(0, 2)]), stopsKm: [1] }, EVERY);

    test('says when a train reaches a stop, and a point it passes on the way', () => {
      expect(passSeconds(timetable, 1, 1)).toBeCloseTo(1 / TRAIN_KM_PER_SECOND);
      expect(passSeconds(timetable, 0.5, 1)).toBeCloseTo(0.5 / TRAIN_KM_PER_SECOND);
    });

    test('says when one heading back reaches it, later in its round', () => {
      const heading = timetable.wayIncludingTurnSeconds + timetable.tripSeconds;
      expect(passSeconds(timetable, 1, -1)).toBeCloseTo(heading - 1 / TRAIN_KM_PER_SECOND - TRAIN_STOP_SECONDS);
    });
  });

  describe('placesOf', () => {
    const timetable = timetableOf({ ...routeOf([segmentOf(0, 1)]), stopsKm: [] }, EVERY);
    const { tripSeconds, roundSeconds, run } = timetable;

    test('runs out along the route, then back the same way', () => {
      const halfway = placesOf(timetable, tripSeconds / 2);
      expect(halfway).toContainEqual({ run, km: 0.5, heading: 1 });
      expect(halfway).toContainEqual({ run, km: 0.5, heading: -1 });
    });

    test('has no train in sight while it turns at an end, for the next to run into', () => {
      expect(placesOf(timetable, tripSeconds + 1)).toEqual([]);
      expect(placesOf(timetable, roundSeconds - 1)).toEqual([]);
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

    test('runs a loop both ways round, as a line runs both ways', () => {
      const looped = timetableOf({ ...routeOf([segmentOf(0, 30)], { ends: ['a', 'a'] }), stopsKm: [] }, EVERY);
      expect(new Set(placesOf(looped, 10).map(({ heading }) => heading))).toEqual(new Set([1, -1]));
    });

    test('comes round to where it was, so it never jumps', () => {
      expect(placesOf(timetable, roundSeconds + 1)).toEqual(placesOf(timetable, 1));
    });

    test('runs a clock behind its start as well as one ahead', () => {
      expect(placesOf({ ...timetable, phaseSeconds: -roundSeconds }, 1)).toEqual(placesOf(timetable, 1));
    });
  });

  describe('timetablesOf', () => {
    const shared = segmentOf(0, 3);

    test("shares a line's interval among its routes: more routes, each no more often", () => {
      const trunk = segmentOf(9, 60);
      const alone = timetablesOf([routeOf([trunk, segmentOf(1, 2)])]);
      const forked = timetablesOf([routeOf([trunk, segmentOf(1, 2)]), routeOf([trunk, segmentOf(2, 2)]), routeOf([trunk, segmentOf(3, 2)])]);
      expect(forked[0]?.everySeconds).toBeCloseTo((alone[0]?.everySeconds ?? 0) * 3);
    });

    test('never leaves a short line empty: a train comes as often as its trip takes', () => {
      const [timetable] = timetablesOf([routeOf([segmentOf(0, 1)])]);
      expect(timetable?.everySeconds).toBeCloseTo(timetable?.tripSeconds ?? 0);
    });

    test('leaves a route that shares nothing on its own clock', () => {
      expect(timetablesOf([routeOf([shared])]).map(timetable => timetable.phaseSeconds)).toEqual([0]);
    });

    test('keeps each line to itself', () => {
      const lines = timetablesOf([routeOf([shared]), routeOf([segmentOf(1, 3)], { line: 'blue' }), routeOf([segmentOf(2, 3)])]).map(({ run }) => run.line);
      expect(lines).toEqual([lineId('red'), lineId('red'), lineId('blue')]);
    });

    test('never has routes ending together reach their end at once', () => {
      const [first, second] = timetablesOf([routeOf([segmentOf(0, 8)], { ends: ['a', 'z'] }), routeOf([segmentOf(1, 8)], { ends: ['b', 'z'] })]);
      const arrival = (timetable: typeof first) => ((timetable?.tripSeconds ?? 0) - (timetable?.phaseSeconds ?? 0)) % (timetable?.everySeconds ?? 1);
      expect(Math.abs(arrival(first) - arrival(second))).toBeGreaterThan(1);
    });
  });
});
