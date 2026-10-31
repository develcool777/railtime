import type { ReachInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { formatMinutes, reachGroups } from '~/features/explorer/reach/reach.utils';

/** A reach from A: B and C in the first band, D in the third, the second empty. */
const reach: ReachInfo = {
  from: { id: 'a', name: 'A' },
  stations: [
    { id: 'b', name: 'B', minutes: 4, band: 0 },
    { id: 'c', name: 'C', minutes: 12, band: 0 },
    { id: 'd', name: 'D', minutes: 40, band: 2 },
  ],
  bands: [
    { upTo: 15, label: 'Under 15 min', color: '#000001' },
    { upTo: 30, label: '15–30 min', color: '#000002' },
    { upTo: null, label: 'Over 30 min', color: '#000003' },
  ],
  track: [],
};

describe('ReachUtils', () => {
  describe('reachGroups', () => {
    test('puts each station in its band, soonest first', () => {
      expect(reachGroups(reach).map(group => group.stations.map(station => station.id))).toEqual([['b', 'c'], [], ['d']]);
    });

    test('keeps every band, an empty one too, in order', () => {
      expect(reachGroups(reach).map(group => [group.position, group.band.label])).toEqual([
        [0, 'Under 15 min'],
        [1, '15–30 min'],
        [2, 'Over 30 min'],
      ]);
    });
  });

  describe('formatMinutes', () => {
    test('says minutes under an hour, rounded', () => {
      expect(formatMinutes(44.6)).toBe('45 min');
    });

    test('says hours and the minutes over', () => {
      expect(formatMinutes(60)).toBe('1 h');
      expect(formatMinutes(112)).toBe('1 h 52 min');
    });
  });
});
