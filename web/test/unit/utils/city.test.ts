import type { CityIndex } from '@railtime/schema/cityIndex.types';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { citiesByCountry, cityMenu, matchesFilter, networkUrlOf, planToOpen, previewUrlOf } from '../../../app/utils/city.utils';
import { CITIES } from '../../../app/utils/explorer.constants';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

/** What the site serves at `/data/`. */
const SERVED = fileURLToPath(new URL('../../../../packages/data/cities/', import.meta.url));

describe('CityUtils', () => {
  describe('citiesByCountry', () => {
    test('groups every city under its country, in menu order', () => {
      const groups = citiesByCountry();
      expect(groups.map(group => group.country)).toEqual(['United Kingdom', 'Ukraine', 'Czechia', 'Hungary', 'Latvia', 'Poland', 'Portugal', 'Slovakia']);
      expect(groups.flatMap(group => group.cities.map(city => city.value))).toContain('kyiv');
    });
  });

  describe('cityMenu', () => {
    test('heads each group with its country', () => {
      expect(cityMenu()[1]![0]).toEqual({ type: 'label', label: 'Ukraine' });
    });
  });

  describe('networkUrlOf', () => {
    test("finds every city's dataset in its country's folder", () => {
      expect(networkUrlOf('tyne-and-wear')).toBe('data/united-kingdom/tyne-and-wear/tyne-and-wear.json');
      for (const city of CITIES) expect(existsSync(`${SERVED}${networkUrlOf(city.value).replace(/^data\//, '')}`), city.value).toBe(true);
    });

    test("finds every city's previews beside its dataset", () => {
      expect(previewUrlOf('kyiv', 'dark')).toBe('data/ukraine/kyiv/kyiv.dark.webp');
      for (const city of CITIES) expect(existsSync(`${SERVED}${previewUrlOf(city.value, 'light').replace(/^data\//, '')}`), city.value).toBe(true);
    });

    test('lists in the index every city the menu has, and no other', () => {
      const index: CityIndex = JSON.parse(readFileSync(`${SERVED}cities.json`, 'utf8'));
      expect(Object.keys(index).sort()).toEqual(CITIES.map(city => city.value).sort());
    });
  });

  describe('planToOpen', () => {
    test('opens the plan asked for, or a network never built on its first', () => {
      expect(planToOpen(planOnlyNetwork(), 'second')).toBe('second');
      expect(planToOpen(planOnlyNetwork(), 'nowhere')).toBe('first');
      expect(planToOpen(planOnlyNetwork(), undefined)).toBe('first');
    });
  });

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
