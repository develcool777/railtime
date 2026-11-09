import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { CITIES } from '~/constants/city.constants';
import {
  boundaryUrlOf,
  citiesByCountry,
  cityMenu,
  cityNameOf,
  citySummaryOf,
  fetchAskedBoundary,
  fetchBoundary,
  isCity,
  networkUrlOf,
  previewUrlOf,
  socialUrlOf,
} from '~/utils/city.utils';

/** What the site serves at `/data/`. */
const SERVED = fileURLToPath(new URL('../../../../packages/data/cities/', import.meta.url));

describe('CityUtils', () => {
  describe('isCity', () => {
    test('takes a city with a dataset, and nothing else', () => {
      expect(isCity('kyiv')).toBe(true);
      expect([isCity('atlantis'), isCity(''), isCity(undefined), isCity(['kyiv'])]).toEqual([false, false, false, false]);
    });
  });

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

    test('refuses a city it does not know, rather than give a path to nothing', () => {
      expect(() => networkUrlOf('atlantis')).toThrow('atlantis');
    });

    test("finds every city's previews beside its dataset", () => {
      expect(previewUrlOf('kyiv', 'dark')).toBe('data/ukraine/kyiv/kyiv.dark.webp');
      for (const city of CITIES) expect(existsSync(`${SERVED}${previewUrlOf(city.value, 'light').replace(/^data\//, '')}`), city.value).toBe(true);
    });
  });

  describe('boundaryUrlOf', () => {
    test("finds every city's outline beside its dataset", () => {
      expect(boundaryUrlOf('kyiv')).toBe('data/ukraine/kyiv/kyiv.boundary.json');
      for (const city of CITIES) expect(existsSync(`${SERVED}${boundaryUrlOf(city.value).replace(/^data\//, '')}`), city.value).toBe(true);
    });
  });

  describe('cityNameOf', () => {
    test("gives a city's name as the menu does, or the id for a city it does not know", () => {
      expect(cityNameOf('tyne-and-wear')).toBe('Tyne and Wear');
      expect(cityNameOf('atlantis')).toBe('atlantis');
    });
  });

  describe('socialUrlOf', () => {
    test("is beside the city's dataset, and every city built has one", () => {
      expect(socialUrlOf('kyiv')).toBe('data/ukraine/kyiv/kyiv.social.jpg');
      expect(CITIES.filter(city => !existsSync(`${SERVED}${socialUrlOf(city.value).replace(/^data\//, '')}`))).toEqual([]);
    });
  });

  describe('citySummaryOf', () => {
    test("gives a city's entry in cities.json", () => {
      expect(citySummaryOf('kyiv')).toMatchObject({ name: 'Kyiv', country: 'Ukraine' });
    });

    test('refuses a city not in cities.json', () => {
      expect(() => citySummaryOf('atlantis')).toThrow('atlantis is not in cities.json');
    });
  });

  describe('fetchBoundary', () => {
    test('gives the outline served, and none for an address that serves something else or nothing', async () => {
      const outline = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } };
      await expect(fetchBoundary(`data:application/json,${encodeURIComponent(JSON.stringify(outline))}`)).resolves.toEqual(outline);
      await expect(fetchBoundary('data:application/json,not%20an%20outline')).resolves.toBeNull();
      await expect(fetchBoundary('http://127.0.0.1:9/outline.json')).resolves.toBeNull();
    });
  });

  describe('fetchAskedBoundary', () => {
    const outline = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } };
    const url = `data:application/json,${encodeURIComponent(JSON.stringify(outline))}`;

    /**
     * What a store does with an outline, kept to look at.
     *
     * @returns What was taken, and how to take one.
     */
    const taker = () => {
      const taken: unknown[] = [];
      return {
        taken,
        take: (answer: unknown) => {
          taken.push(answer);
        },
      };
    };

    test('hands over the outline while it is still the one asked for, and says so of none', async () => {
      const { taken, take } = taker();
      await fetchAskedBoundary(url, () => url, take);
      await fetchAskedBoundary('data:application/json,nothing', () => 'data:application/json,nothing', take);
      expect(taken).toEqual([outline, null]);
    });

    test('drops an answer once another is asked for, or none is', async () => {
      const { taken, take } = taker();
      await fetchAskedBoundary(url, () => 'elsewhere', take);
      await fetchAskedBoundary(url, () => null, take);
      expect(taken).toEqual([]);
    });
  });
});
