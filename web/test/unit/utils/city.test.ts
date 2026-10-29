import { describe, expect, test } from 'vitest';
import { citiesByCountry, cityMenu, isPlanOnly, matchesFilter, planToOpen, summaryOf } from '../../../app/utils/city.utils';
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

  describe('matchesFilter', () => {
    const kyiv = { label: 'Kyiv', value: 'kyiv', country: 'Ukraine' };
    const summary = { ...summaryOf(planOnlyNetwork()), planOnly: false, networks: ['Kyiv Metro'] };
    const all = { query: '', country: '', kind: 'all' as const, withPlans: false };

    test('matches the name, country or a network, in any case', () => {
      expect(matchesFilter(kyiv, summary, { ...all, query: 'KYI' })).toBe(true);
      expect(matchesFilter(kyiv, summary, { ...all, query: 'ukr' })).toBe(true);
      expect(matchesFilter(kyiv, summary, { ...all, query: 'metro' })).toBe(true);
      expect(matchesFilter(kyiv, summary, { ...all, query: 'london' })).toBe(false);
    });

    test('keeps a country, a kind of city, and cities with plans', () => {
      expect(matchesFilter(kyiv, summary, { ...all, country: 'United Kingdom' })).toBe(false);
      expect(matchesFilter(kyiv, summary, { ...all, kind: 'history' })).toBe(true);
      expect(matchesFilter(kyiv, summary, { ...all, kind: 'never-built' })).toBe(false);
      expect(matchesFilter(kyiv, { ...summary, plans: 0 }, { ...all, withPlans: true })).toBe(false);
    });

    test('shows a city still loading only when no filter needs its dataset', () => {
      expect(matchesFilter(kyiv, null, all)).toBe(true);
      expect(matchesFilter(kyiv, null, { ...all, kind: 'history' })).toBe(false);
    });
  });
});
