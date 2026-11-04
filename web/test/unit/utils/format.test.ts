import { describe, expect, test } from 'vitest';
import { counted, formatNumber, lineColor } from '~/utils/format.utils';

describe('FormatUtils', () => {
  describe('formatNumber', () => {
    test('rounds a value and marks its thousands', () => {
      expect(formatNumber(1284.4)).toBe('1,284');
      expect(formatNumber(7.6)).toBe('8');
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
});
