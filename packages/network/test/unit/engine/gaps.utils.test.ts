import { describe, expect, test } from 'vitest';
import { outsideGaps } from '../../../src/engine/gaps.utils';

describe('GapsUtils', () => {
  describe('outsideGaps', () => {
    test('cuts a run at each gap, a piece either side, and leaves one outside them all whole', () => {
      const gaps = [
        { from: 30, until: 40 },
        { from: 10, until: 20 },
      ];
      expect(outsideGaps(0, 50, gaps)).toEqual([
        { opens: 0, closes: 10 },
        { opens: 20, closes: 30 },
        { opens: 40, closes: 50 },
      ]);
      expect(outsideGaps(60, null, gaps)).toEqual([{ opens: 60, closes: null }]);
    });

    test('runs a piece on after the last gap while the run does, and leaves nothing of a run inside one', () => {
      expect(outsideGaps(0, null, [{ from: -Infinity, until: 20 }])).toEqual([{ opens: 20, closes: null }]);
      expect(outsideGaps(12, 18, [{ from: 10, until: 20 }])).toEqual([]);
    });
  });
});
