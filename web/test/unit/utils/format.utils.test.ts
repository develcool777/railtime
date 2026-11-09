import { describe, expect, test } from 'vitest';
import { counted, formatNumber, formatPlanFacts, formatShare, formatWalk, lineColor, pluralOf } from '~/utils/format.utils';

describe('FormatUtils', () => {
  describe('formatNumber', () => {
    test('rounds a value and marks its thousands', () => {
      expect(formatNumber(1284.4)).toBe('1,284');
      expect(formatNumber(7.6)).toBe('8');
    });
  });

  describe('pluralOf', () => {
    test('reads as a count rounds, for one still counting', () => {
      expect([pluralOf(1, 'line'), pluralOf(1.2, 'line'), pluralOf(2, 'line'), pluralOf(0, 'line')]).toEqual(['line', 'line', 'lines', 'lines']);
    });
  });

  describe('counted', () => {
    test('puts the noun in the plural but for one, the count written as the site writes numbers', () => {
      expect([counted(0, 'line'), counted(1, 'line'), counted(2, 'line'), counted(1284, 'station')]).toEqual([
        '0 lines',
        '1 line',
        '2 lines',
        '1,284 stations',
      ]);
    });
  });

  describe('lineColor', () => {
    test("gives a line's colour in both themes, for the page's colour scheme to pick", () => {
      expect(lineColor({ light: '#ff0000', dark: '#ff6666' })).toBe('light-dark(#ff0000, #ff6666)');
    });
  });

  describe('formatShare', () => {
    test('gives a whole percentage, with a decimal under 10, and none for nothing', () => {
      expect([0.342, 0.0996, 0.0994, 0.042, 0.0001, 0, 1].map(formatShare)).toEqual(['34%', '10%', '9.9%', '4.2%', '0.0%', '0%', '100%']);
    });
  });

  describe('formatWalk', () => {
    test('gives a walk under a kilometre in metres, a longer one in km', () => {
      expect([400, 800, 1200, 1000, 2000].map(formatWalk)).toEqual(['400 m', '800 m', '1.2 km', '1 km', '2 km']);
    });
  });

  describe('formatPlanFacts', () => {
    test('says what a plan adds, leaving out what it adds none of', () => {
      expect(formatPlanFacts(4, 6.2)).toBe('adds 4 stations · 6 km');
      expect(formatPlanFacts(1, 0.2)).toBe('adds 1 station');
      expect(formatPlanFacts(0, 3)).toBe('adds 3 km');
      expect(formatPlanFacts(0, 0.2)).toBe('');
    });
  });
});
