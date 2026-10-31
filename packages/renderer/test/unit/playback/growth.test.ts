import { describe, expect, test } from 'vitest';
import type { TrackSegment } from '../../../src/network/index.types';
import { planGrowth } from '../../../src/playback/growth.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

/**
 * A segment of a made-up stretch, as long as given: growth reads only its ends and length.
 *
 * @param index - Its id.
 * @param stationA - One end.
 * @param stationB - The other.
 * @param lengthKm - Its length.
 * @returns The segment.
 */
const track = (index: number, stationA: string, stationB: string, lengthKm: number): TrackSegment => ({
  index,
  stationA,
  stationB,
  coordinates: [],
  reversedCoordinates: [],
  distances: [],
  reversedDistances: [],
  lengthKm,
  travel: 1,
});

describe('GrowthUtils', () => {
  describe('planGrowth', () => {
    test('grows out of stations already on the map, reaching new ones in order', () => {
      const { index } = playbackOf(tinyNetwork());
      const growth = planGrowth(index.segments.slice(1), new Set(['a', 'b']), station => index.coordOf(station), index.centre);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['b', false],
        ['c', true],
        ['d', true],
      ]);
      expect(growth.totalKm).toBeCloseTo(2, 0);
    });

    test('grows one way between two stations already on the map, from the one nearer the centre', () => {
      // A gap filled: West and East on the map, Middle new between them; the centre by East.
      const segments = [track(0, 'west', 'middle', 1), track(1, 'middle', 'east', 1)];
      const placeOf = (station: string): [number, number] => [{ west: 0, middle: 1, east: 2 }[station] ?? 0, 0];
      const growth = planGrowth(segments, new Set(['west', 'east']), placeOf, [2, 0]);
      expect(growth.reach.map(reached => reached.station)).toEqual(['east', 'middle', 'west']);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [false, 1],
        [false, 0],
      ]);
      expect(growth.totalKm).toBe(2);
    });

    test('grows a new line crossing the network from its end nearer the centre, through the station they share, not out of it', () => {
      const segments = [track(0, 'north', 'cross', 1), track(1, 'cross', 'south', 1)];
      const placeOf = (station: string): [number, number] => [0, { north: 2, cross: 1, south: 0 }[station] ?? 0];
      const growth = planGrowth(segments, new Set(['cross']), placeOf, [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['south', true],
        ['cross', false],
        ['north', true],
      ]);
    });

    test('grows a fork from its one start, its branches side by side, each segment from its nearer end', () => {
      // Out of O, on the map: Near 1 km, then Far 1 km on and Beyond 3 km on, each listed from its far end.
      const segments = [track(0, 'o', 'near', 1), track(1, 'far', 'near', 1), track(2, 'beyond', 'near', 3)];
      const growth = planGrowth(segments, new Set(['o']), () => [0, 0], [0, 0]);
      expect(growth.reach).toEqual([
        { station: 'o', km: 0, isNew: false },
        { station: 'near', km: 1, isNew: true },
        { station: 'far', km: 2, isNew: true },
        { station: 'beyond', km: 4, isNew: true },
      ]);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [true, 0],
        [false, 1],
        [false, 1],
      ]);
      expect(growth.totalKm).toBe(4);
    });

    test('grows a loop, which has no end, from its station on the map, each way round by the shorter', () => {
      // O on the map; P 1 km one way, Q 2 km the other, P–Q 2 km.
      const segments = [track(0, 'o', 'p', 1), track(1, 'p', 'q', 2), track(2, 'q', 'o', 2)];
      const growth = planGrowth(segments, new Set(['o']), () => [0, 0], [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.km])).toEqual([
        ['o', 0],
        ['p', 1],
        ['q', 2],
      ]);
    });

    test('starts a stretch that touches nothing from its end nearest the centre', () => {
      const { index } = playbackOf(tinyNetwork());
      const growth = planGrowth(index.segments, new Set(), station => index.coordOf(station), [0.05, 51.5]);
      expect(growth.reach[0]?.station).toBe('d');
    });
  });
});
