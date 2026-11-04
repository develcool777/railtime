import type { RouteInfo, RouteLegInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { ROUTE_STRENGTHS } from '~/features/explorer/route/route.constants';
import { rideSummary, routeDifference, routeStrengths, routeSummary, routeVia } from '~/features/explorer/route/route.utils';

/**
 * A ride on a line.
 *
 * @param lineName - The line's name.
 * @param stops - How many stops it rides.
 * @returns The ride.
 */
const ride = (lineName: string, stops: number): Extract<RouteLegInfo, { kind: 'ride' }> => ({
  kind: 'ride',
  line: lineName.toLowerCase(),
  lineName,
  color: { light: '#000000', dark: '#ffffff' },
  stops: Array.from({ length: stops + 1 }, (_, position) => ({ id: `s${position}`, name: `S${position}` })),
  minutes: stops * 2.4,
  km: stops,
});

/**
 * A route of legs.
 *
 * @param legs - Its legs.
 * @param changes - How many times it changes.
 * @param best - What it is best at.
 * @param minutes - How long it takes.
 * @returns The route.
 */
const routeOf = (legs: RouteLegInfo[], changes: number, best: RouteInfo['best'] = [], minutes = 20): RouteInfo => ({
  from: { id: 'a', name: 'A' },
  to: { id: 'z', name: 'Z' },
  legs,
  minutes,
  km: 11.6,
  changes,
  segments: [],
  best,
});

describe('RouteUtils', () => {
  describe('routeSummary', () => {
    test('counts the stops ridden, the changes and the km', () => {
      expect(routeSummary(routeOf([ride('Red line', 5), ride('Blue line', 3)], 1))).toBe('8 stops · 1 change · 12 km');
      expect(routeSummary(routeOf([ride('Red line', 1)], 0))).toBe('1 stop · no change · 12 km');
    });
  });

  describe('routeVia', () => {
    test('names where each ride after the first is boarded, a walk between them aside; a way with none is direct', () => {
      const walk: RouteLegInfo = { kind: 'walk', from: { id: 'b', name: 'B' }, to: { id: 'g', name: 'G' }, minutes: 6 };
      const green = {
        ...ride('Green line', 1),
        stops: [
          { id: 'g', name: 'G' },
          { id: 'e', name: 'E' },
        ],
      };
      const blue = {
        ...ride('Blue line', 1),
        stops: [
          { id: 'e', name: 'E' },
          { id: 'f', name: 'F' },
        ],
      };
      expect(routeVia(routeOf([ride('Red line', 1), walk, green, blue], 2))).toBe('via G, E');
      expect(routeVia(routeOf([ride('Red line', 3)], 0))).toBe('Direct');
    });
  });

  describe('routeDifference', () => {
    const fastest = routeOf([], 1, ['fastest'], 53.2);

    test('says how much longer or shorter a way takes, and how many more or fewer changes', () => {
      expect(routeDifference(routeOf([], 3, [], 61), fastest)).toBe('+8 min · 2 more changes');
      expect(routeDifference(routeOf([], 0, [], 56), fastest)).toBe('+3 min · 1 fewer change');
      expect(routeDifference(routeOf([], 2, [], 53.4), fastest)).toBe('1 more change');
    });

    test('says nothing of the same', () => {
      expect(routeDifference(fastest, fastest)).toBe('');
    });
  });

  describe('routeStrengths', () => {
    test('says what a route is best at, or nothing', () => {
      expect(routeStrengths(routeOf([], 0, ['fastest', 'fewest-changes']))).toEqual([ROUTE_STRENGTHS.fastest, ROUTE_STRENGTHS['fewest-changes']]);
      expect(routeStrengths(routeOf([], 0))).toEqual([]);
    });
  });

  describe('rideSummary', () => {
    test('counts its stops and minutes', () => {
      expect(rideSummary(ride('Red line', 2))).toBe('2 stops · 5 min');
    });
  });
});
