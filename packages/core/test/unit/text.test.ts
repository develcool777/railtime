import { describe, expect, test } from 'vitest';
import { byCodeUnits, slugOf } from '../../src/text.utils';

describe('TextUtils', () => {
  describe('slugOf', () => {
    test('lowers a name and joins its words with hyphens', () => {
      expect([slugOf('United Kingdom'), slugOf('Czechia'), slugOf(' Bosnia  and Herzegovina ')]).toEqual([
        'united-kingdom',
        'czechia',
        'bosnia-and-herzegovina',
      ]);
    });
  });

  describe('byCodeUnits', () => {
    test('orders as a bare sort does: digits before capitals before lower case, a prefix before what it starts', () => {
      expect(['b', 'B', '2026-01-02', 'a-b', 'a', '1863-01-10'].toSorted(byCodeUnits)).toEqual(['1863-01-10', '2026-01-02', 'B', 'a', 'a-b', 'b']);
    });

    test('says two equal texts are the same', () => {
      expect(byCodeUnits('pink', 'pink')).toBe(0);
    });
  });
});
