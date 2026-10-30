import { describe, expect, test } from 'vitest';
import { formatMetric, growthSeries, hasHistory, niceTicks, yearTicks } from '~/features/explorer/insights/insights.utils';

describe('InsightsUtils', () => {
  describe('niceTicks', () => {
    test('steps by 1, 2 or 5 times a power of ten, from nought to past the highest', () => {
      expect(niceTicks(384)).toEqual([0, 200, 400]);
      expect(niceTicks(745)).toEqual([0, 500, 1000]);
      expect(niceTicks(18)).toEqual([0, 10, 20]);
    });

    test('has only nought with nothing to show', () => {
      expect(niceTicks(0)).toEqual([0]);
    });
  });

  describe('yearTicks', () => {
    test('marks round years, further apart the longer it runs', () => {
      expect(yearTicks(1862, 2026)).toEqual([1900, 1950, 2000]);
      expect(yearTicks(1970, 2026)).toEqual([1975, 2000, 2025]);
      expect(yearTicks(2001, 2026)).toEqual([2010, 2020]);
    });
  });

  describe('growthSeries', () => {
    test('takes one measure, year by year', () => {
      const years = [
        { year: 1900, stations: 3, km: 2.5, lines: 1 },
        { year: 1901, stations: 5, km: 4, lines: 2 },
      ];
      expect(growthSeries(years, 'km')).toEqual([
        { year: 1900, value: 2.5 },
        { year: 1901, value: 4 },
      ]);
    });
  });

  describe('formatMetric', () => {
    test('writes each measure with its unit, one in the singular', () => {
      expect(formatMetric(1284, 'stations')).toBe('1,284 stations');
      expect(formatMetric(1, 'lines')).toBe('1 line');
      expect(formatMetric(744.6, 'km')).toBe('745 km');
    });
  });

  describe('hasHistory', () => {
    test('has one once any year has a station, and none for a network never built', () => {
      const year = (stations: number) => ({ year: 2000, stations, km: 0, lines: 0 });
      expect(hasHistory({ years: [year(0), year(4)], decades: [] })).toBe(true);
      expect(hasHistory({ years: [year(0), year(0)], decades: [] })).toBe(false);
    });
  });
});
