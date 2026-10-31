import { describe, expect, test } from 'vitest';
import { easeInOut, easeOutBack } from '../../../src/core/easing.utils';

describe('EasingUtils', () => {
  describe('easeInOut', () => {
    test('starts and ends on its bounds, half-way at the middle, slow at either end', () => {
      expect(easeInOut(0)).toBeCloseTo(0);
      expect(easeInOut(0.5)).toBeCloseTo(0.5);
      expect(easeInOut(1)).toBe(1);
      expect(easeInOut(0.1)).toBeLessThan(0.1);
      expect(easeInOut(0.9)).toBeGreaterThan(0.9);
    });
  });

  describe('easeOutBack', () => {
    test('overshoots on the way, then settles on 1', () => {
      expect(easeOutBack(0)).toBeCloseTo(0);
      expect(easeOutBack(0.6)).toBeGreaterThan(1);
      expect(easeOutBack(1)).toBe(1);
    });
  });
});
