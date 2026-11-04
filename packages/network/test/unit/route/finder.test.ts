import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { CHANGE_MINUTES, RIDE_KMH, WALK_MINUTES } from '../../../src/route/finder.constants';
import { PriorityQueue, RouteFinder } from '../../../src/route/finder.service';
import type { Route } from '../../../src/route/finder.types';
import { routeNetwork } from '../../support/factories/routeNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The ways between two stations, today, fastest first.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns The routes.
 */
const optionsOf = (from: string, to: string): Route[] => {
  const index = new NetworkIndex(routeNetwork());
  const timeline = new Timeline(index);
  return new RouteFinder(index, timeline).options(from, to, timeline.steps.length);
};

/**
 * The fastest route between two stations, today.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns The route, or `null`.
 */
const routeOf = (from: string, to: string): Route | null => optionsOf(from, to)[0] ?? null;

/** Each leg, as its line or `walk`. */
const legsOf = (route: Route | null) => route?.legs.map(leg => (leg.kind === 'ride' ? leg.line : 'walk'));

/** Minutes to ride the 3 km between the stops these tests ride between. */
const THREE_KM_MINUTES = (3 / RIDE_KMH) * 60;

describe('RouteFinder', () => {
  describe('options', () => {
    test('rides one line from stop to stop, its time from the track', () => {
      const route = routeOf('a', 'd');
      expect(route?.legs).toMatchObject([{ kind: 'ride', line: 'red', stops: ['a', 'b', 'c', 'd'] }]);
      expect(route).toMatchObject({ changes: 0 });
      expect(route?.km).toBeCloseTo(3, 1);
      expect(route?.minutes).toBeCloseTo(THREE_KM_MINUTES, 0);
    });

    test('changes line, and counts the change and its minutes', () => {
      const route = routeOf('a', 'e');
      expect(legsOf(route)).toEqual(['red', 'blue']);
      expect(route?.legs[1]).toMatchObject({ stops: ['c', 'e'] });
      expect(route?.changes).toBe(1);
      expect(route?.minutes).toBeCloseTo(THREE_KM_MINUTES + CHANGE_MINUTES, 0);
    });

    test('walks a transfer when that is quicker than riding round', () => {
      const route = routeOf('b', 'g');
      expect(route?.legs).toEqual([{ kind: 'walk', from: 'b', to: 'g', minutes: WALK_MINUTES }]);
      expect(route?.changes).toBe(0);
    });

    test('offers the fastest, the way that changes least, and the fastest round a line the others ride: fastest first', () => {
      const options = optionsOf('a', 'e');
      expect(options.map(legsOf)).toEqual([['red', 'blue'], ['red', 'walk', 'green'], ['yellow']]);
      expect(options.map(route => route.minutes)).toEqual(options.map(route => route.minutes).toSorted((first, second) => first - second));
    });

    test('offers no way off a line and back on it: a detour, not a way', () => {
      // Grey then pink then grey again is quick enough to be offered, but rides grey twice.
      expect(optionsOf('p', 's').map(legsOf)).toEqual([['grey']]);
    });

    test('offers a way once, however many searches find it, and none much slower than the fastest', () => {
      // Round red there is only yellow, blue and red again: far slower, and red besides.
      expect(optionsOf('a', 'd').map(legsOf)).toEqual([['red']]);
    });

    test('rides past a station its line does not call at, and finds nothing where nothing runs', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      expect(finder.options('b', 'd', timeline.cursorAt(Date.UTC(1915, 6, 1)))[0]?.legs).toMatchObject([{ stops: ['b', 'd'] }]);
      expect(finder.options('b', 'c', timeline.cursorAt(Date.UTC(1915, 6, 1)))).toEqual([]);
      expect(finder.options('a', 'c', timeline.cursorAt(Date.UTC(1905, 0, 1)))).toEqual([]);
      expect(optionsOf('a', 'a')).toEqual([]);
    });
  });

  describe('reach', () => {
    test('times every station from the start, by its fastest route, soonest first', () => {
      const index = new NetworkIndex(routeNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      const reach = finder.reach('a', timeline.steps.length);
      expect(reach.get('a')).toBe(0);
      expect(reach.get('d')).toBeCloseTo(THREE_KM_MINUTES, 0);
      for (const station of ['b', 'c', 'd', 'e', 'g', 'h']) {
        expect(reach.get(station)).toBeCloseTo(finder.options('a', station, timeline.steps.length)[0]?.minutes ?? NaN, 5);
      }
      const times = [...reach.values()];
      expect(times).toEqual([...times].toSorted((first, second) => first - second));
    });

    test('reaches nothing from a station no line calls at on the date', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      expect(new RouteFinder(index, timeline).reach('c', timeline.cursorAt(Date.UTC(1915, 6, 1))).size).toBe(0);
    });
  });
});

describe('PriorityQueue', () => {
  test('gives items back cheapest first, whatever order they came in', () => {
    const queue = new PriorityQueue<string>();
    const costs = [5, 1, 9, 3, 7, 2, 8, 0, 6, 4];
    for (const cost of costs) queue.push(`item ${cost}`, cost);
    expect(queue.size).toBe(costs.length);
    const out: number[] = [];
    for (let next = queue.pop(); next; next = queue.pop()) out.push(next.cost);
    expect(out).toEqual([...costs].toSorted((first, second) => first - second));
  });

  test('is empty once every item is out', () => {
    const queue = new PriorityQueue<string>();
    queue.push('only', 1);
    expect(queue.pop()).toEqual({ cost: 1, item: 'only' });
    expect(queue.pop()).toBeUndefined();
    expect(queue.size).toBe(0);
  });

  test('keeps cheapest first through many items, ties among them, taken out as more come in', () => {
    const queue = new PriorityQueue<number>();
    const out: number[] = [];
    // A spread of costs with repeats, half taken out before the rest arrive.
    const costs = Array.from({ length: 200 }, (_, position) => (position * 37) % 50);
    for (const cost of costs.slice(0, 100)) queue.push(cost, cost);
    for (let taken = 0; taken < 50; taken++) out.push(queue.pop()!.cost);
    for (const cost of costs.slice(100)) queue.push(cost, cost);
    for (let next = queue.pop(); next; next = queue.pop()) out.push(next.cost);
    const firstHalf = costs.slice(0, 100).toSorted((first, second) => first - second);
    expect(out.slice(0, 50)).toEqual(firstHalf.slice(0, 50));
    expect(out.slice(50)).toEqual([...firstHalf.slice(50), ...costs.slice(100)].toSorted((first, second) => first - second));
  });
});
