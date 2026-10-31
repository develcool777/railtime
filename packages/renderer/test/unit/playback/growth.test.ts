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

    test('reaches each station by its shortest way, nearest first, and draws each segment from its nearer end', () => {
      // Out of O: Far 5 km straight, found first, or 2 km by Near (1 km, listed from Near); Beyond 1 km past Far.
      const segments = [track(0, 'o', 'far', 5), track(1, 'near', 'o', 1), track(2, 'near', 'far', 1), track(3, 'far', 'beyond', 1)];
      const growth = planGrowth(segments, new Set(['o']), () => [0, 0], [0, 0]);
      expect(growth.reach).toEqual([
        { station: 'o', km: 0, isNew: false },
        { station: 'near', km: 1, isNew: true },
        { station: 'far', km: 2, isNew: true },
        { station: 'beyond', km: 3, isNew: true },
      ]);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [true, 0],
        [false, 0],
        [true, 1],
        [true, 2],
      ]);
      // The straight 5 km is drawn from O at once: it ends last.
      expect(growth.totalKm).toBe(5);
    });

    test('starts a stretch that touches nothing from its end nearest the centre', () => {
      const { index } = playbackOf(tinyNetwork());
      const growth = planGrowth(index.segments, new Set(), station => index.coordOf(station), [0.05, 51.5]);
      expect(growth.reach[0]?.station).toBe('d');
    });
  });
});
