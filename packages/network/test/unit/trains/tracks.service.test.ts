import { lineId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { TrackTimetable } from '../../../src/trains/tracks.service';
import { CYCLE_SECONDS, TRACK_USE, TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import type { TrainRun } from '../../../src/trains/trains.types';
import { rideOf, turnSecondsOf, withinCycle } from '../../../src/trains/trains.utils';
import { trackOf, trainRunOf } from '../../support/factories/trainRuns.utils';

/** How a metro runs: what these routes are. */
const METRO = TRAIN_PROFILES.metro;

/** How many metro trains a cycle one track has room for. */
const METRO_ROOM = (TRACK_USE * CYCLE_SECONDS) / METRO.closestSeconds;

/**
 * When each route's trains set out.
 *
 * @param runs - The routes.
 * @returns Each route's departures.
 */
const departuresOf = (runs: TrainRun[]) => new TrackTimetable(runs.map(rideOf)).departures;

/**
 * The shortest time between two of some trains setting out, round the cycle.
 *
 * @param departures - When each sets out.
 * @returns The shortest gap, seconds.
 */
const tightestOf = (departures: number[]): number => {
  const sorted = departures.toSorted((first, second) => first - second);
  let tightest = Infinity;
  for (const [place, departure] of sorted.entries()) tightest = Math.min(tightest, (sorted[place + 1] ?? (sorted[0] ?? 0) + CYCLE_SECONDS) - departure);
  return tightest;
};

describe('TrackTimetable', () => {
  const trunk = trackOf(9, 10);

  test("runs a route that shares nothing at its kind's headway, evenly from the start of the cycle", () => {
    const [{ out } = { out: [] }] = departuresOf([trainRunOf([trunk])]);
    expect(out).toEqual(Array.from({ length: CYCLE_SECONDS / METRO.headwaySeconds }, (_unused, train) => train * METRO.headwaySeconds));
  });

  test('sets a lone route off back as soon as it has turned at the far end', () => {
    const run = trainRunOf([trunk]);
    const [{ out, back } = { out: [], back: [] }] = departuresOf([run]);
    expect(back.map(Math.round)).toEqual(out.map(departure => Math.round(withinCycle(departure + rideOf(run).seconds + turnSecondsOf(run)))));
  });

  test.each([2, 3, 4])('shares a track %s branches run along between them, at least a train each, no more than it has room for', branches => {
    const departures = departuresOf(
      Array.from({ length: branches }, (_unused, branch) => trainRunOf([trunk, trackOf(branch, 2)], { ends: ['a', `end${branch}`] })),
    );
    const trains = departures.map(({ out }) => out.length);
    expect(Math.min(...trains)).toBeGreaterThanOrEqual(1);
    expect(trains.reduce((sum, each) => sum + each, 0)).toBeLessThanOrEqual(Math.min(METRO_ROOM, (branches * CYCLE_SECONDS) / METRO.headwaySeconds));
  });

  test.each([2, 3, 4])('brings %s branches along their trunk in turn, no two closer than signals let them', branches => {
    const departures = departuresOf(
      Array.from({ length: branches }, (_unused, branch) => trainRunOf([trunk, trackOf(branch, 2)], { ends: ['a', `end${branch}`] })),
    );
    expect(tightestOf(departures.flatMap(({ out }) => out))).toBeGreaterThanOrEqual(METRO.closestSeconds - 1);
  });

  test("keeps two lines' trains on the track they share as far apart as signals let them", () => {
    const departures = departuresOf([trainRunOf([trunk]), trainRunOf([trunk], { line: 'blue', ends: ['c', 'd'] })]);
    expect(tightestOf(departures.flatMap(({ out }) => out))).toBeGreaterThanOrEqual(METRO.closestSeconds - 1);
  });

  test('leaves lines on tracks of their own beside each other on their own clocks', () => {
    const besides = trackOf(9, 10, [[lineId('red')], [lineId('blue')]]);
    const departures = departuresOf([trainRunOf([besides]), trainRunOf([besides], { line: 'blue', ends: ['c', 'd'] })]);
    expect(departures.map(({ out }) => out)).toEqual([departures[0]?.out, departures[0]?.out]);
    expect(departures[0]?.out).toHaveLength(CYCLE_SECONDS / METRO.headwaySeconds);
  });

  test("runs a line on a segment whose tracks do not name it on a track of its own, as a plan's line", () => {
    const named = trackOf(9, 10, [[lineId('red')], [lineId('blue')]]);
    const departures = departuresOf([trainRunOf([named]), trainRunOf([named], { line: 'green', ends: ['c', 'd'] })]);
    expect(departures[1]?.out).toEqual(departures[0]?.out);
  });

  test('lets lines ending at one station on track of their own keep their own platforms', () => {
    const departures = departuresOf([trainRunOf([trackOf(0, 8)], { ends: ['a', 'z'] }), trainRunOf([trackOf(1, 8)], { line: 'blue', ends: ['b', 'z'] })]);
    expect(departures.map(({ out }) => out[0])).toEqual([0, 0]);
  });

  test('places the most frequent line first, from the start of the cycle, and the other round it', () => {
    const suburban = { ...trainRunOf([trunk], { line: 'blue', ends: ['c', 'd'] }), mode: 'suburban-rail' as const };
    const [blue, red] = departuresOf([suburban, trainRunOf([trunk])]);
    expect(red?.out[0]).toBe(0);
    expect(blue?.out).toHaveLength(CYCLE_SECONDS / TRAIN_PROFILES['suburban-rail'].headwaySeconds);
    expect(blue?.out[0]).not.toBe(0);
  });

  test('gives what room whole trains leave to the line running fewest', () => {
    const departures = departuresOf([
      trainRunOf([trunk, trackOf(1, 2)], { ends: ['a', 'x'] }),
      trainRunOf([trunk, trackOf(2, 2)], { ends: ['a', 'y'] }),
      trainRunOf([trunk], { line: 'blue', ends: ['c', 'd'] }),
    ]);
    const [first = 0, second = 0, blue = 0] = departures.map(({ out }) => out.length);
    expect(blue).toBeGreaterThan(first);
    expect(first + second + blue).toBeLessThanOrEqual(METRO_ROOM);
  });
});
