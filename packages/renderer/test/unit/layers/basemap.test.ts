import { describe, expect, test } from 'vitest';
import { guardMissingNumbers } from '../../../src/layers/basemap.utils';
import { MISSING_NUMBER } from '../../../src/layers/theme.constants';

describe('BasemapUtils', () => {
  describe('guardMissingNumbers', () => {
    test('gives a compared value a stand-in that fails the comparison as a missing one does', () => {
      expect(guardMissingNumbers(['<=', ['get', 'ref_length'], 6])).toEqual(['<=', ['coalesce', ['get', 'ref_length'], MISSING_NUMBER], 6]);
      expect(guardMissingNumbers(['>', ['get', 'rank'], 2])).toEqual(['>', ['coalesce', ['get', 'rank'], -MISSING_NUMBER], 2]);
      expect(guardMissingNumbers(['<', 3, ['get', 'rank']])).toEqual(['<', 3, ['coalesce', ['get', 'rank'], -MISSING_NUMBER]]);
    });

    test('guards a comparison inside an "all"', () => {
      const filter = ['all', ['<=', ['get', 'ref_length'], 6], ['match', ['get', 'network'], ['a'], true, false]];
      expect(guardMissingNumbers(filter)).toEqual([
        'all',
        ['<=', ['coalesce', ['get', 'ref_length'], MISSING_NUMBER], 6],
        ['match', ['get', 'network'], ['a'], true, false],
      ]);
    });

    test('hands back the very filter where nothing needs guarding, a guarded one too', () => {
      const plain = ['==', ['get', 'class'], 'motorway'];
      expect(guardMissingNumbers(plain)).toBe(plain);
      const guarded = guardMissingNumbers(['<=', ['get', 'ref_length'], 6]);
      expect(guardMissingNumbers(guarded)).toBe(guarded);
    });
  });
});
