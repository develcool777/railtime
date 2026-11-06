import { entriesOf, fromEntriesOf } from '@railtime/core/collection.utils';
import type { Mode, Network, StationId } from '@railtime/schema/network.types';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/engine/index.service';
import { Timeline } from '../../../src/engine/timeline.service';
import { CHANGE_MINUTES, WALK_MINUTES } from '../../../src/route/finder.constants';
import { PriorityQueue, RouteFinder } from '../../../src/route/finder.service';
import type { Route } from '../../../src/route/finder.types';
import { rideSeconds } from '../../../src/trains/motion.utils';
import { trainRunsAt } from '../../../src/trains/routes.utils';
import { passSeconds, timetableOf } from '../../../src/trains/schedule.utils';
import { TRAIN_PROFILES } from '../../../src/trains/trains.constants';
import { loopNetwork } from '../../support/factories/loopNetwork.utils';
import { routeNetwork } from '../../support/factories/routeNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/**
 * The ways between two stations, today, fastest first.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @returns The routes.
 */
const optionsOf = (from: StationId, to: StationId): Route[] => {
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
const routeOf = (from: StationId, to: StationId): Route | null => optionsOf(from, to)[0] ?? null;

/** Each leg, as its line or `walk`. */
const legsOf = (route: Route | null) => route?.legs.map(leg => (leg.kind === 'ride' ? leg.line : 'walk'));

/** Minutes a metro takes from coming to a stop to coming to the next, a km on. */
const STOP_MINUTES = (TRAIN_PROFILES.metro.standSeconds + rideSeconds(TRAIN_PROFILES.metro, 1)) / 60;

/**
 * A network's finder, and its cursor today.
 *
 * @param network - The network.
 * @returns The finder, and every step played.
 */
const finderOf = (network: Network) => {
  const index = new NetworkIndex(network);
  const timeline = new Timeline(index);
  return { finder: new RouteFinder(index, timeline), index, timeline, today: timeline.steps.length };
};

/**
 * The tiny network with its lines of one mode.
 *
 * @param mode - What kind of railway they are.
 * @returns The network.
 */
const tinyOf = (mode: Mode): Network => {
  const network = tinyNetwork();
  network.lines[lineId('red')] = { ...network.lines[lineId('red')]!, mode };
  return network;
};

describe('RouteFinder', () => {
  describe('options', () => {
    test('rides one line from stop to stop, its time from the track', () => {
      const route = routeOf(stationId('a'), stationId('d'));
      expect(route?.legs).toMatchObject([{ kind: 'ride', line: 'red', stops: ['a', 'b', 'c', 'd'] }]);
      expect(route).toMatchObject({ changes: 0 });
      expect(route?.km).toBeCloseTo(3, 1);
      expect(route?.minutes).toBeCloseTo(3 * STOP_MINUTES, 1);
    });

    test("takes a ride's minutes from the timetable its line's trains keep, stops included", () => {
      const { finder, index, timeline, today } = finderOf(routeNetwork());
      const run = trainRunsAt(index, timeline, today).find(each => each.line === lineId('red'))!;
      const timetable = timetableOf(run, 300);
      const [route] = finder.options(...run.ends, today);
      expect(route?.minutes).toBeCloseTo((passSeconds(timetable, run.lengthKm, 1) - passSeconds(timetable, 0, 1)) / 60, 5);
    });

    test("times a ride by its own line's kind of railway", () => {
      const minutesAs = (mode: Mode) => {
        const { finder, today } = finderOf(tinyOf(mode));
        return finder.options(stationId('a'), stationId('c'), today)[0]?.minutes ?? NaN;
      };
      const seconds = (mode: Mode) => 2 * (TRAIN_PROFILES[mode].standSeconds + rideSeconds(TRAIN_PROFILES[mode], 1));
      expect(minutesAs('metro')).toBeCloseTo(seconds('metro') / 60, 1);
      expect(minutesAs('tram')).toBeCloseTo(seconds('tram') / 60, 1);
      expect(minutesAs('cable')).toBeGreaterThan(minutesAs('metro'));
    });

    test('rides past a station its line does not stop at as one run, standing nowhere there', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const { finder, timeline } = finderOf(tinyNetwork());
      const [route] = finder.options(stationId('b'), stationId('d'), timeline.cursorAt(Date.UTC(1915, 6, 1)));
      expect(route?.minutes).toBeCloseTo((TRAIN_PROFILES.metro.standSeconds + rideSeconds(TRAIN_PROFILES.metro, 2)) / 60, 1);
    });

    test('rides a one-way line only the way it goes, round the long way if it must', () => {
      const network = loopNetwork();
      network.lines = fromEntriesOf(entriesOf(network.lines).filter(([line]) => line === 'clockwise'));
      network.segments = network.segments.filter(segment => 'clockwise' in segment.lines);
      const { finder, today } = finderOf(network);
      // Clockwise goes A, C, B: from A to B it rides round by C; from B to A, straight.
      expect(finder.options(stationId('a'), stationId('b'), today)[0]?.legs).toMatchObject([{ stops: ['a', 'c', 'b'] }]);
      expect(finder.options(stationId('b'), stationId('a'), today)[0]?.legs).toMatchObject([{ stops: ['b', 'a'] }]);
    });

    test('rides lines drawn as one as one line: no change, and named as the map draws it', () => {
      // Pink, on A – B – C, is drawn as red until 1990, its own line after; red runs A – B and C – D.
      const network = tinyNetwork();
      network.segments[1]!.lines = { [lineId('pink')]: { open: '1910-01-01' } };
      network.stations[stationId('c')] = { ...network.stations[stationId('c')]!, infill: { [lineId('pink')]: '1911-01-01' } };
      const { closed: _closed, ...open } = network.stations[stationId('d')]!;
      network.stations[stationId('d')] = open;
      const { finder, timeline } = finderOf(network);
      const when = (year: number) => timeline.cursorAt(Date.UTC(year, 6, 1));
      const [drawn] = finder.options(stationId('b'), stationId('d'), when(1935));
      expect(drawn).toMatchObject({ changes: 0, legs: [{ kind: 'ride', line: 'red', stops: ['b', 'c', 'd'] }] });
      const [apart] = finder.options(stationId('b'), stationId('d'), when(1995));
      expect(apart).toMatchObject({ changes: 1, legs: [{ line: 'pink' }, { kind: 'ride' }] });
      expect(apart?.minutes).toBeCloseTo((drawn?.minutes ?? NaN) + CHANGE_MINUTES, 5);
    });

    test('changes line, and counts the change and its minutes', () => {
      const route = routeOf(stationId('a'), stationId('e'));
      expect(legsOf(route)).toEqual(['red', 'blue']);
      expect(route?.legs[1]).toMatchObject({ stops: ['c', 'e'] });
      expect(route?.changes).toBe(1);
      expect(route?.minutes).toBeCloseTo(3 * STOP_MINUTES + CHANGE_MINUTES, 1);
    });

    test('walks a transfer when that is quicker than riding round', () => {
      const route = routeOf(stationId('b'), stationId('g'));
      expect(route?.legs).toEqual([{ kind: 'walk', from: 'b', to: 'g', minutes: WALK_MINUTES }]);
      expect(route?.changes).toBe(0);
    });

    test('offers the fastest, the way that changes least, and the fastest round a line the others ride: fastest first', () => {
      const options = optionsOf(stationId('a'), stationId('e'));
      expect(options.map(legsOf)).toEqual([['red', 'blue'], ['red', 'walk', 'green'], ['yellow']]);
      expect(options.map(route => route.minutes)).toEqual(options.map(route => route.minutes).toSorted((first, second) => first - second));
    });

    test('offers no way off a line and back on it: a detour, not a way', () => {
      // Grey then pink then grey again is quick enough to be offered, but rides grey twice.
      expect(optionsOf(stationId('p'), stationId('s')).map(legsOf)).toEqual([['grey']]);
    });

    test('offers a way once, however many searches find it, and none much slower than the fastest', () => {
      // Round red there is only yellow, blue and red again: far slower, and red besides.
      expect(optionsOf(stationId('a'), stationId('d')).map(legsOf)).toEqual([['red']]);
    });

    test('rides past a station its line does not call at, and finds nothing where nothing runs', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      expect(finder.options(stationId('b'), stationId('d'), timeline.cursorAt(Date.UTC(1915, 6, 1)))[0]?.legs).toMatchObject([{ stops: ['b', 'd'] }]);
      expect(finder.options(stationId('b'), stationId('c'), timeline.cursorAt(Date.UTC(1915, 6, 1)))).toEqual([]);
      expect(finder.options(stationId('a'), stationId('c'), timeline.cursorAt(Date.UTC(1905, 0, 1)))).toEqual([]);
      expect(optionsOf(stationId('a'), stationId('a'))).toEqual([]);
    });
  });

  describe('reach', () => {
    test('times every station from the start, by its fastest route, soonest first', () => {
      const index = new NetworkIndex(routeNetwork());
      const timeline = new Timeline(index);
      const finder = new RouteFinder(index, timeline);
      const reach = finder.reach(stationId('a'), timeline.steps.length);
      expect(reach.get(stationId('a'))).toBe(0);
      expect(reach.get(stationId('d'))).toBeCloseTo(3 * STOP_MINUTES, 1);
      for (const station of ['b', 'c', 'd', 'e', 'g', 'h']) {
        expect(reach.get(stationId(station))).toBeCloseTo(finder.options(stationId('a'), stationId(station), timeline.steps.length)[0]?.minutes ?? NaN, 5);
      }
      const times = [...reach.values()];
      expect(times).toEqual([...times].toSorted((first, second) => first - second));
    });

    test('reaches nothing from a station no line calls at on the date', () => {
      // On the small network, C is on red's track from 1910 but a stop only from 1920.
      const index = new NetworkIndex(tinyNetwork());
      const timeline = new Timeline(index);
      expect(new RouteFinder(index, timeline).reach(stationId('c'), timeline.cursorAt(Date.UTC(1915, 6, 1))).size).toBe(0);
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
