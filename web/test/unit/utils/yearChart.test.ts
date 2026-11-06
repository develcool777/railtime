import { describe, expect, test } from 'vitest';
import { yearTicksOf } from '~/utils/yearChart.utils';

/**
 * Every year from one to another.
 *
 * @param first - The first.
 * @param last - The last.
 * @returns The years.
 */
const yearsBetween = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, place) => first + place);

describe('YearChartUtils', () => {
  describe('yearTicksOf', () => {
    test('labels a history of decades at its decades', () => {
      expect(yearTicksOf(yearsBetween(1960, 2026))).toEqual([1960, 1970, 1980, 1990, 2000, 2010, 2020]);
    });

    test('labels a long history more coarsely, and a short one by the year', () => {
      expect(yearTicksOf(yearsBetween(1863, 2026))).toEqual([1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020]);
      expect(yearTicksOf(yearsBetween(2019, 2024))).toEqual([2019, 2020, 2021, 2022, 2023, 2024]);
    });

    test('labels only years it plots, and none for none', () => {
      expect(yearTicksOf([1958, 1961, 1970, 1993])).toEqual([1970]);
      expect(yearTicksOf([])).toEqual([]);
    });
  });
});
