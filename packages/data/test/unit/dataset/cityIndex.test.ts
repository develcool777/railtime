import { parseNetwork } from '@railtime/schema/network.schema';
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CITY_INDEX_PATH, datasets } from '../../../src/dataset/city.utils.ts';
import { formatCityIndex, indexEntryOf } from '../../../src/dataset/cityIndex.utils.ts';

/** Every city's network, with its country. */
const CITIES = datasets().map(({ country, city, path }) => ({ country, city, network: parseNetwork(JSON.parse(readFileSync(path, 'utf8'))) }));

/**
 * A city's network, by its id.
 *
 * @param id - The city's folder.
 * @returns Its network and country.
 */
const cityOf = (id: string) => {
  const found = CITIES.find(candidate => candidate.city === id);
  if (!found) throw new Error(`No dataset for ${id}`);
  return found;
};

describe('CityIndexUtils', () => {
  describe('indexEntryOf', () => {
    test('sums up a network with a history: when it opened, its lines and stations', () => {
      const { network, country } = cityOf('london');
      const entry = indexEntryOf(network, country);
      expect(entry).toMatchObject({ name: 'London', country: 'united-kingdom', openedYear: 1863, planOnly: false });
      expect(entry.lines).toBeGreaterThan(10);
      expect(entry.plans).toBe(Object.keys(network.plans ?? {}).length);
    });

    test('sums up a network never built by its first plan', () => {
      const { network, country } = cityOf('bratislava');
      const entry = indexEntryOf(network, country);
      expect(entry).toMatchObject({ planOnly: true, openedYear: null });
      expect(entry.stations).toBeGreaterThan(0);
      expect(entry.lines).toBeGreaterThan(0);
    });
  });

  describe('formatCityIndex', () => {
    test('cities/cities.json is the index of every dataset as they are (pnpm data:format <city>)', () => {
      const index = Object.fromEntries(CITIES.map(({ country, city, network }) => [city, indexEntryOf(network, country)]));
      expect(readFileSync(CITY_INDEX_PATH, 'utf8')).toBe(formatCityIndex(index));
    });
  });
});
