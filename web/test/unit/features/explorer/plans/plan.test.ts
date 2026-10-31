import { describe, expect, test } from 'vitest';
import { openingSectionOf } from '~/features/explorer/plans/plan.utils';

describe('PlanUtils', () => {
  describe('openingSectionOf', () => {
    test('opens on Plans with a plan shown, else on Lines', () => {
      expect(openingSectionOf('extension')).toBe('plans');
      expect(openingSectionOf(undefined)).toBe('lines');
    });
  });
});
