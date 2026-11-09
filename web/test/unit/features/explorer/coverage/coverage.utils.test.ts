import { describe, expect, test } from 'vitest';
import { coverageDistanceOf, formatArea } from '~/features/explorer/coverage/coverage.utils';

describe('CoverageUtils', () => {
  describe('coverageDistanceOf', () => {
    test('reads one of the distances coverage counts within, from text or a number, and nothing else', () => {
      expect([coverageDistanceOf('400'), coverageDistanceOf(1200), coverageDistanceOf('800'), coverageDistanceOf('2000')]).toEqual([400, 1200, 800, 2000]);
      expect([coverageDistanceOf('500'), coverageDistanceOf('far'), coverageDistanceOf(undefined)]).toEqual([undefined, undefined, undefined]);
    });
  });

  describe('formatArea', () => {
    test('gives a big area in whole km², grouped, and a small one to a decimal', () => {
      expect([1572.4, 3.44, 10, 0].map(formatArea)).toEqual(['1,572 km²', '3.4 km²', '10 km²', '0.0 km²']);
    });
  });
});
