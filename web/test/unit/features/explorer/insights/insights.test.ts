import { describe, expect, test } from 'vitest';
import { formatMetric, formatNumber, growthSeries, hasHistory } from '~/features/explorer/insights/insights.utils';

describe('InsightsUtils', () => {
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

  describe('formatNumber', () => {
    test('writes a value whole, thousands marked', () => {
      expect(formatNumber(1284.4)).toBe('1,284');
    });
  });
});
