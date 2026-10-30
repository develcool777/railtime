import { describe, expect, test } from 'vitest';
import { decadeOf, formatPlanFacts, formatStats } from '~/features/explorer/format.utils';

describe('FormatUtils', () => {
  describe('formatPlanFacts', () => {
    test('says what a plan adds, leaving out what it adds none of', () => {
      expect(formatPlanFacts(4, 6.2)).toBe('adds 4 stations · 6 km');
      expect(formatPlanFacts(1, 0.2)).toBe('adds 1 station');
      expect(formatPlanFacts(0, 3)).toBe('adds 3 km');
      expect(formatPlanFacts(0, 0.2)).toBe('');
    });
  });

  describe('formatStats', () => {
    test('says what is on the map, shorter for a phone', () => {
      expect(formatStats({ stations: 384, km: 744.6, lines: 20 })).toBe('384 stations · 745 km · 20 lines');
      expect(formatStats({ stations: 1, km: 2, lines: 1 })).toBe('1 station · 2 km · 1 line');
      expect(formatStats({ stations: 384, km: 744.6, lines: 20 }, true)).toBe('384 st. · 745 km');
    });
  });

  describe('decadeOf', () => {
    test('names the decade of a date, or the future for a plan', () => {
      expect(decadeOf(Date.UTC(1933, 6, 31))).toBe('1930s');
      expect(decadeOf(Date.UTC(1940, 0, 1))).toBe('1940s');
      expect(decadeOf(null)).toBe('Future');
    });
  });
});
