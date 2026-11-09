import { describe, expect, test } from 'vitest';
import { entriesOf, firstDifference, fromEntriesOf, keysOf, pairsOf, pushTo } from '../../src/collection.utils';

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

  describe('pairsOf', () => {
    test('is each item with the one after it, and none for too few', () => {
      expect(pairsOf(['a', 'b', 'c'])).toEqual([
        ['a', 'b'],
        ['b', 'c'],
      ]);
      expect(pairsOf(['a'])).toEqual([]);
      expect(pairsOf([])).toEqual([]);
    });
  });

  describe('keysOf', () => {
    test("is a record's own keys, in its order", () => {
      expect(keysOf({ b: 1, a: 2 })).toEqual(['b', 'a']);
      expect(keysOf({})).toEqual([]);
    });
  });

  describe('entriesOf', () => {
    test("is a record's own keys with their values, in its order", () => {
      expect(entriesOf({ b: 1, a: 2 })).toEqual([
        ['b', 1],
        ['a', 2],
      ]);
    });
  });

  describe('fromEntriesOf', () => {
    test('makes a record of entries, a later key over an earlier one', () => {
      expect(
        fromEntriesOf([
          ['b', 1],
          ['a', 2],
          ['b', 3],
        ]),
      ).toEqual({ b: 3, a: 2 });
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
