import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
import { CHANGE_MINUTES, RIDE_KMH, WALK_MINUTES } from '../../../src/model/routeFinder.constants';
import { RouteFinder } from '../../../src/model/routeFinder.service';
import type { Route } from '../../../src/model/routeFinder.types';
import { Timeline } from '../../../src/model/timeline.service';
import { routeNetwork } from '../../support/factories/routeNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The route between two stations, today.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @param preference - Fastest, or fewer changes.
 * @returns The route.
 */
const routeOf = (from: string, to: string, preference: 'fastest' | 'fewer-changes' = 'fastest'): Route | null => {
  const index = new NetworkIndex(routeNetwork());
  const timeline = new Timeline(index);
  return new RouteFinder(index, timeline).find(from, to, timeline.steps.length, preference);
};

/** Each leg, as its line or `walk`. */
const legsOf = (route: Route | null) => route?.legs.map(leg => (leg.kind === 'ride' ? leg.line : 'walk'));

/** Minutes to ride so many km. */
const ride = (km: number) => (km / RIDE_KMH) * 60;

describe('RouteFinder', () => {
  describe('find', () => {
    test('rides one line from stop to stop, its time from the track', () => {
      const route = routeOf('a', 'd');
      expect(route?.legs).toMatchObject([{ kind: 'ride', line: 'red', stops: ['a', 'b', 'c', 'd'] }]);
      expect(route).toMatchObject({ changes: 0 });
      expect(route?.km).toBeCloseTo(3, 1);
      expect(route?.minutes).toBeCloseTo(ride(3), 0);
    });

    test('changes line, and counts the change and its minutes', () => {
      const route = routeOf('a', 'e');
      expect(legsOf(route)).toEqual(['red', 'blue']);
      expect(route?.legs[1]).toMatchObject({ stops: ['c', 'e'] });
      expect(route?.changes).toBe(1);
      expect(route?.minutes).toBeCloseTo(ride(3) + CHANGE_MINUTES, 0);
    });

    test('walks a transfer when that is quicker than riding round', () => {
      const route = routeOf('b', 'g');
      expect(route?.legs).toEqual([{ kind: 'walk', from: 'b', to: 'g', minutes: WALK_MINUTES }]);
      expect(route?.changes).toBe(0);
    });

    test('takes the long way with no change, when changes should be few', () => {
      expect(legsOf(routeOf('a', 'e', 'fewer-changes'))).toEqual(['yellow']);
    });

    test('rides past a station its line does not call at, and finds nothing where nothing runs', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      expect(finder.find('b', 'd', timeline.cursorAt(Date.UTC(1915, 6, 1)))?.legs).toMatchObject([{ stops: ['b', 'd'] }]);
      expect(finder.find('b', 'c', timeline.cursorAt(Date.UTC(1915, 6, 1)))).toBeNull();
      expect(finder.find('a', 'c', timeline.cursorAt(Date.UTC(1905, 0, 1)))).toBeNull();
      expect(routeOf('a', 'a')).toBeNull();
    });
  });

  describe('reach', () => {
    test('times every station from the start, by its fastest route, soonest first', () => {
      const index = new NetworkIndex(routeNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      const reach = finder.reach('a', timeline.steps.length);
      expect(reach.get('a')).toBe(0);
      expect(reach.get('d')).toBeCloseTo(ride(3), 0);
      for (const station of ['b', 'c', 'd', 'e', 'g', 'h']) {
        expect(reach.get(station)).toBeCloseTo(finder.find('a', station, timeline.steps.length)?.minutes ?? Number.NaN, 5);
      }
      const times = [...reach.values()];
      expect(times).toEqual([...times].sort((first, second) => first - second));
    });

    test('reaches nothing from a station no line calls at on the date', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      expect(new RouteFinder(index, timeline).reach('c', timeline.cursorAt(Date.UTC(1915, 6, 1))).size).toBe(0);
    });
  });
});
