import { describe, expect, test } from 'vitest';

import { formatArea, formatShare } from '~/features/explorer/coverage/coverage.utils';

describe('CoverageUtils', () => {
  describe('formatShare', () => {
    test('gives a whole percentage, with a decimal under 10, and none for nothing', () => {
      expect([0.342, 0.0996, 0.0994, 0.042, 0.0001, 0, 1].map(formatShare)).toEqual(['34%', '10%', '9.9%', '4.2%', '0.0%', '0%', '100%']);
    });
  });

  describe('formatArea', () => {
    test('gives a big area in whole km², grouped, and a small one to a decimal', () => {
      expect([1572.4, 3.44, 10, 0].map(formatArea)).toEqual(['1,572 km²', '3.4 km²', '10 km²', '0.0 km²']);
    });
  });
});
