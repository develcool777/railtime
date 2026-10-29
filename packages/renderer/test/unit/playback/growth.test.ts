import { describe, expect, test } from 'vitest';
import { planGrowth } from '../../../src/playback/growth.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

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

    test('starts a stretch that touches nothing from its end nearest the centre', () => {
      const { index } = playbackOf(tinyNetwork());
      const growth = planGrowth(index.segments, new Set(), station => index.coordOf(station), [0.05, 51.5]);
      expect(growth.reach[0]?.station).toBe('d');
    });
  });
});
