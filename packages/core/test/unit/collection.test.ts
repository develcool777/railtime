import { describe, expect, test } from 'vitest';
import { pushTo } from '../../src/collection.utils';

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
});
