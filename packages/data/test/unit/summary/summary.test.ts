import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SUMMARIES_PATH, cities, readNetwork } from '../../../src/city.utils.ts';
import { formatSummaries, summaryOf } from '../../../src/summary/summary.utils.ts';

/** Every city's network, with its country. */
const CITIES = cities().map(city => ({ country: city.country, city: city.id, network: readNetwork(city) }));

/**
 * A city's network, by its id.
 *
 * @param id - The city's folder.
 * @returns Its network and country.
 */
const cityOf = (id: string) => {
  const found = CITIES.find(candidate => candidate.city === id);
  if (!found) throw new Error(`No city ${id}`);
  return found;
};

describe('SummaryUtils', () => {
  describe('summaryOf', () => {
    test('sums up a network with a history: when it opened, its lines and stations', () => {
      const { network, country } = cityOf('london');
      const entry = summaryOf(network, country);
      expect(entry).toMatchObject({ name: 'London', country: 'united-kingdom', openedYear: 1863, planOnly: false });
      expect(entry.lines).toBeGreaterThan(10);
      expect(entry.plans).toBe(Object.keys(network.plans ?? {}).length);
    });

    test('sums up a network never built by its first plan', () => {
      const { network, country } = cityOf('bratislava');
      const entry = summaryOf(network, country);
      expect(entry).toMatchObject({ planOnly: true, openedYear: null });
      expect(entry.stations).toBeGreaterThan(0);
      expect(entry.lines).toBeGreaterThan(0);
    });
  });

  describe('formatSummaries', () => {
    test('cities/cities.json is the index of every city as they are (pnpm data:summaries)', () => {
      const index = Object.fromEntries(CITIES.map(({ country, city, network }) => [city, summaryOf(network, country)]));
      expect(readFileSync(SUMMARIES_PATH, 'utf8')).toBe(formatSummaries(index));
    });
  });
});
