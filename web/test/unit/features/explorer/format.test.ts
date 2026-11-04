import { describe, expect, test } from 'vitest';
import { decadeHeading, formatStats } from '~/features/explorer/format.utils';

describe('FormatUtils', () => {
  describe('formatStats', () => {
    test('says what is on the map, shorter for a phone', () => {
      expect(formatStats({ stations: 384, km: 744.6, lines: 20 })).toBe('384 stations · 745 km · 20 lines');
      expect(formatStats({ stations: 1, km: 2, lines: 1 })).toBe('1 station · 2 km · 1 line');
      expect(formatStats({ stations: 384, km: 744.6, lines: 20 }, true)).toBe('384 st. · 745 km');
    });
  });

  describe('decadeHeading', () => {
    test("names the decade of a date, or Plan for a plan's change", () => {
      expect(decadeHeading(Date.UTC(1933, 6, 31))).toBe('1930s');
      expect(decadeHeading(Date.UTC(1940, 0, 1))).toBe('1940s');
      expect(decadeHeading(null)).toBe('Plan');
    });
  });
});
