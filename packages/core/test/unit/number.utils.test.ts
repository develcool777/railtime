import { describe, expect, test } from 'vitest';
import { clamp } from '../../src/number.utils';

describe('NumberUtils', () => {
  describe('clamp', () => {
    test('holds a value within its bounds', () => {
      expect([clamp(-1, 0, 1), clamp(0.5, 0, 1), clamp(2, 0, 1)]).toEqual([0, 0.5, 1]);
    });
  });
});
