import { describe, expect, test } from 'vitest';
import { networkHistory, openingsByDecade, statsAt } from '../../../src/network/history.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { modelOf } from '../../support/model.utils';

describe('HistoryUtils', () => {
  describe('networkHistory', () => {
    test('takes every year from the start, each as at its end', () => {
      const { index, timeline } = modelOf(tinyNetwork());
      const { years } = networkHistory(index, timeline, 2026);
      expect(years[0]?.year).toBe(1899);
      expect(years.at(-1)?.year).toBe(2026);
      expect(years).toHaveLength(2026 - 1899 + 1);
      expect(years.find(entry => entry.year === 1935)).toMatchObject(statsAt(index, timeline, timeline.cursorAt(Date.UTC(1935, 11, 31))));
    });

    test('keeps the year each station was first on the map, a closed one too', () => {
      const { index, timeline } = modelOf(tinyNetwork());
      const { firstYears } = networkHistory(index, timeline, 2026);
      expect(firstYears.get('a')).toBe(1900);
      expect(firstYears.get('d')).toBe(1910);
    });
  });

  describe('openingsByDecade', () => {
    test('counts each decade, one with none between too', () => {
      const firstYears = new Map([
        ['a', 1900],
        ['b', 1905],
        ['c', 1931],
      ]);
      expect(openingsByDecade(firstYears)).toEqual([
        { decade: 1900, stations: 2 },
        { decade: 1910, stations: 0 },
        { decade: 1920, stations: 0 },
        { decade: 1930, stations: 1 },
      ]);
    });

    test('has no decade with no station', () => {
      expect(openingsByDecade(new Map())).toEqual([]);
    });
  });
});
