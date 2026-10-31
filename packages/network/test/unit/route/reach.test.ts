import { describe, expect, test } from 'vitest';
import { REACH_BANDS } from '../../../src/route/reach.constants';
import { bandOf, reachedSegments } from '../../../src/route/reach.utils';

describe('ReachUtils', () => {
  describe('bandOf', () => {
    test('puts a time in the first band it fits, its end included', () => {
      expect(bandOf(0)).toBe(0);
      expect(bandOf(15)).toBe(0);
      expect(bandOf(15.5)).toBe(1);
      expect(bandOf(59)).toBe(3);
    });

    test('puts anything longer in the last band', () => {
      expect(bandOf(240)).toBe(REACH_BANDS.length - 1);
    });
  });

  describe('reachedSegments', () => {
    const segments = [
      { index: 0, stationA: 'a', stationB: 'b' },
      { index: 1, stationA: 'b', stationB: 'c' },
      { index: 2, stationA: 'x', stationB: 'y' },
    ];

    test('times a segment by the mean of its ends, or its one end reached', () => {
      const minutes = new Map([
        ['a', 0],
        ['b', 10],
      ]);
      expect(reachedSegments(minutes, segments)).toEqual([
        { segment: 0, minutes: 5 },
        { segment: 1, minutes: 10 },
      ]);
    });

    test('leaves out a segment with neither end reached', () => {
      expect(reachedSegments(new Map(), segments)).toEqual([]);
    });
  });
});
