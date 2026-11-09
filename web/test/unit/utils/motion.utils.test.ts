import { describe, expect, test } from 'vitest';
import { easedOut, fadedIn } from '~/utils/motion.utils';

describe('MotionUtils', () => {
  describe('fadedIn', () => {
    test('rises from nothing to whole over the fade, and stays', () => {
      expect(fadedIn(-100, 600)).toBe(0);
      expect(fadedIn(300, 600)).toBe(0.5);
      expect(fadedIn(9000, 600)).toBe(1);
    });
  });

  describe('easedOut', () => {
    test('runs from nothing to whole, arriving slowly', () => {
      expect(easedOut(0)).toBe(0);
      expect(easedOut(1)).toBe(1);
      expect(easedOut(0.5)).toBeGreaterThan(0.5);
    });
  });
});
