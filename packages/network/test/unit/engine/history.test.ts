import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { busiestDecade, networkHistory, openingsByDecade, statsAt } from '../../../src/engine/history.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

describe('HistoryUtils', () => {
  describe('networkHistory', () => {
    test('takes every year from the start, each as at its end', () => {
      const { index, timeline } = factsOf(tinyNetwork()).engine;
      const { years } = networkHistory(index, timeline, 2026);
      expect(years[0]?.year).toBe(1899);
      expect(years.at(-1)?.year).toBe(2026);
      expect(years).toHaveLength(2026 - 1899 + 1);
      expect(years.find(entry => entry.year === 1935)).toMatchObject(statsAt(index, timeline, timeline.cursorAt(Date.UTC(1935, 11, 31))));
    });

    test('keeps the year each station was first on the map, a closed one too', () => {
      const { index, timeline } = factsOf(tinyNetwork()).engine;
      const { firstYears } = networkHistory(index, timeline, 2026);
      expect(firstYears.get(stationId('a'))).toBe(1900);
      expect(firstYears.get(stationId('d'))).toBe(1910);
    });
  });

  describe('busiestDecade', () => {
    test('finds the decade most stations opened in, the earliest of a tie', () => {
      const decades = [
        { decade: 1960, stations: 3 },
        { decade: 1970, stations: 9 },
        { decade: 1980, stations: 9 },
      ];
      expect(busiestDecade(decades)).toEqual({ decade: 1970, stations: 9 });
    });

    test('finds none in no decades', () => {
      expect(busiestDecade([])).toBeNull();
    });
  });

  describe('openingsByDecade', () => {
    test('counts each decade, one with none between too', () => {
      const firstYears = new Map([
        [stationId('a'), 1900],
        [stationId('b'), 1905],
        [stationId('c'), 1931],
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
