import { describe, expect, test } from 'vitest';
import { routeStopMarks } from '../../../src/route/stops.utils';
import type { RouteInfo, RouteLegInfo } from '../../../src/transitMap.types';

/**
 * A ride on a line through stops named by their ids.
 *
 * @param color - The line's colour, which is its id too.
 * @param stops - The stops' ids, from where it is boarded.
 * @returns The leg.
 */
const ride = (color: string, stops: string[]): RouteLegInfo => ({
  kind: 'ride',
  line: color,
  lineName: color,
  color,
  stops: stops.map(id => ({ id, name: id.toUpperCase() })),
  minutes: 0,
  km: 0,
});

/**
 * A route made of legs, from the first stop of the first to the given end.
 *
 * @param legs - Its legs.
 * @param to - Where it ends.
 * @returns The route.
 */
const routeOf = (legs: RouteLegInfo[], to: string): RouteInfo => ({
  from: { id: 'a', name: 'A' },
  to: { id: to, name: to.toUpperCase() },
  legs,
  minutes: 0,
  km: 0,
  changes: legs.length - 1,
  segments: [],
});

describe('RouteStopsUtils', () => {
  describe('routeStopMarks', () => {
    test('rings where each ride begins, passes the stops between, ends at the last', () => {
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'b', 'c']), ride('blue', ['c', 'd', 'e'])], 'e'));
      expect(marks.map(entry => [entry.station, entry.kind, entry.color])).toEqual([
        ['a', 'board', 'red'],
        ['b', 'pass', 'red'],
        ['c', 'board', 'blue'],
        ['d', 'pass', 'blue'],
        ['e', 'end', 'blue'],
      ]);
    });

    test('rings both ends of a walk, as changes', () => {
      const walk: RouteLegInfo = { kind: 'walk', from: { id: 'c', name: 'C' }, to: { id: 'x', name: 'X' }, minutes: 3 };
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'c']), walk, ride('blue', ['x', 'e'])], 'e'));
      expect(marks.map(entry => [entry.station, entry.kind])).toEqual([
        ['a', 'board'],
        ['c', 'board'],
        ['x', 'board'],
        ['e', 'end'],
      ]);
    });
  });
});
