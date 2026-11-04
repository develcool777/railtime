import { describe, expect, test } from 'vitest';
import { firstDifference, pushTo } from '../../src/collection.utils';

describe('CollectionUtils', () => {
  describe('pushTo', () => {
    test('starts a list under a new key and adds to one already there, in order', () => {
      const lists = new Map<string, number[]>();
      pushTo(lists, 'a', 1);
      pushTo(lists, 'b', 2);
      pushTo(lists, 'a', 3);
      expect([...lists]).toEqual([
        ['a', [1, 3]],
        ['b', [2]],
      ]);
    });
  });

  describe('firstDifference', () => {
    test('is the first comparison that tells two apart, and zero when none does', () => {
      expect(firstDifference(0, -2, 5)).toBe(-2);
      expect(firstDifference(3, -1)).toBe(3);
      expect(firstDifference(0, 0)).toBe(0);
      expect(firstDifference()).toBe(0);
    });
  });
});
