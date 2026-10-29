import { describe, expect, test } from 'vitest';
import { isPlanOnly, planToOpen, summaryOf } from '../../../app/utils/city.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

describe('CityUtils', () => {
  describe('isPlanOnly', () => {
    test('is a network with plans and no track', () => {
      expect(isPlanOnly(planOnlyNetwork())).toBe(true);
      expect(isPlanOnly({ ...planOnlyNetwork(), plans: {} })).toBe(false);
    });
  });

  describe('planToOpen', () => {
    test('opens the plan asked for, or a network never built on its first', () => {
      expect(planToOpen(planOnlyNetwork(), 'second')).toBe('second');
      expect(planToOpen(planOnlyNetwork(), 'nowhere')).toBe('first');
      expect(planToOpen(planOnlyNetwork(), undefined)).toBe('first');
    });
  });

  describe('summaryOf', () => {
    test('sums up a network never built by its first plan', () => {
      const summary = summaryOf(planOnlyNetwork());
      expect(summary).toMatchObject({ planOnly: true, stations: 3, openedYear: null, networks: ['Metro'] });
      expect(summary.lines.map(line => line.id)).toEqual(['red']);
    });
  });
});
