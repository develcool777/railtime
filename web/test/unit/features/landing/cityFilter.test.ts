import { describe, expect, test } from 'vitest';
import { matchesFilter } from '~/features/landing/cityFilter.utils';

describe('CityFilterUtils', () => {
  describe('matchesFilter', () => {
    const kyiv = { label: 'Kyiv', value: 'kyiv', country: 'Ukraine' };
    const summary = {
      name: 'Kyiv',
      country: 'ukraine',
      networks: ['Kyiv Metro'],
      openedYear: 1960,
      planOnly: false,
      plans: 2,
      lines: 3,
      stations: 52,
    };
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

    test('shows a city while the index loads only when no filter needs it', () => {
      expect(matchesFilter(kyiv, null, all)).toBe(true);
      expect(matchesFilter(kyiv, null, { ...all, kind: 'history' })).toBe(false);
    });
  });
});
