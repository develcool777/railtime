import { describe, expect, test } from 'vitest';
import { DAY_MS, YEAR_MS, toIsoDate, toTimestamp, todayTimestamp } from '../../../src/core/date.utils';

describe('DateUtils', () => {
  describe('toTimestamp', () => {
    test('reads an ISO date as its UTC midnight', () => {
      expect(toTimestamp('1863-01-10')).toBe(Date.UTC(1863, 0, 10));
    });
  });

  describe('toIsoDate', () => {
    test('writes a timestamp as its UTC date, the way it was read', () => {
      expect(toIsoDate(Date.UTC(1968, 2, 7, 23, 59))).toBe('1968-03-07');
      expect(toIsoDate(toTimestamp('1900-07-30'))).toBe('1900-07-30');
    });
  });

  describe('todayTimestamp', () => {
    test("is today's UTC midnight", () => {
      const today = todayTimestamp();
      expect(today % DAY_MS).toBe(0);
      expect(Date.now() - today).toBeLessThan(DAY_MS);
      expect(Date.now()).toBeGreaterThanOrEqual(today);
    });
  });

  describe('DAY_MS and YEAR_MS', () => {
    test('are a day and an average year, leap days included', () => {
      expect(toTimestamp('2000-01-02') - toTimestamp('2000-01-01')).toBe(DAY_MS);
      expect(toTimestamp('2004-01-01') - toTimestamp('2000-01-01')).toBe(4 * YEAR_MS);
    });
  });
});
