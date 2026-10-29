import { describe, expect, test } from 'vitest';
import { citiesByCountry, cityMenu, isLargeCity, isPlanOnly, planToOpen, summaryOf } from '../../../app/utils/city.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

describe('CityUtils', () => {
  describe('citiesByCountry', () => {
    test('groups every city under its country, in menu order', () => {
      const groups = citiesByCountry();
      expect(groups.map(group => group.country)).toEqual(['United Kingdom', 'Ukraine']);
      expect(groups.flatMap(group => group.cities.map(city => city.value))).toContain('kyiv');
    });
  });

  describe('cityMenu', () => {
    test('heads each group with its country', () => {
      expect(cityMenu()[1]![0]).toEqual({ type: 'label', label: 'Ukraine' });
    });
  });

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
      expect(summary).toMatchObject({ planOnly: true, stations: 3, openedYear: null, networks: ['Metro'], plans: 2 });
      expect(summary.lines.map(line => line.id)).toEqual(['red']);
    });
  });

  describe('isLargeCity', () => {
    test('is a big network, or a mid-sized one with futures to show', () => {
      const summary = summaryOf(planOnlyNetwork());
      expect(isLargeCity(summary)).toBe(false);
      expect(isLargeCity({ ...summary, stations: 51, plans: 0 })).toBe(true);
      expect(isLargeCity({ ...summary, lines: [...summary.lines, ...summary.lines, ...summary.lines] })).toBe(true);
    });
  });
});
