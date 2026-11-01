import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { citiesByCountry, cityMenu, networkUrlOf, previewUrlOf } from '~/utils/city.utils';
import { CITIES } from '~/constants/city.constants';

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
  });
});
