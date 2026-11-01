import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SUMMARIES_PATH, cities, readNetwork } from '../../../src/city.utils.ts';
import type { CityIndex } from '@railtime/schema/cityIndex.types';
import { slugOf } from '@railtime/core/text.utils';
import { formatSummaries, inListOrder, summaryOf } from '../../../src/summary/summary.utils.ts';

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
      const { network } = cityOf('london');
      const entry = summaryOf(network);
      expect(entry).toMatchObject({ name: 'London', country: 'United Kingdom', openedYear: 1863, planOnly: false });
      expect(entry.lines).toBeGreaterThan(10);
      expect(entry.plans).toBe(Object.keys(network.plans ?? {}).length);
    });

    test('sums up a network never built by its first plan', () => {
      const entry = summaryOf(cityOf('bratislava').network);
      expect(entry).toMatchObject({ planOnly: true, openedYear: null });
      expect(entry.stations).toBeGreaterThan(0);
      expect(entry.lines).toBeGreaterThan(0);
    });
  });

  describe('inListOrder', () => {
    /** A summary in a country, the rest of it alike. */
    const inCountry = (country: string) => ({ ...summaryOf(cityOf('london').network), country });

    test('keeps the order the list had, a new city after the last of its country, else last, a city gone left out', () => {
      const previous: CityIndex = { first: inCountry('One'), gone: inCountry('One'), second: inCountry('Two'), third: inCountry('One') };
      const summaries: CityIndex = {
        new: inCountry('Three'),
        second: inCountry('Two'),
        added: inCountry('Two'),
        third: inCountry('One'),
        first: inCountry('One'),
      };
      expect(Object.keys(inListOrder(summaries, previous))).toEqual(['first', 'second', 'added', 'third', 'new']);
    });
  });

  describe('formatSummaries', () => {
    test('cities/cities.json is the index of every city as they are, in its own order (pnpm data:summaries)', () => {
      const index = Object.fromEntries(CITIES.map(({ city, network }) => [city, summaryOf(network)]));
      const text = readFileSync(SUMMARIES_PATH, 'utf8');
      expect(text).toBe(formatSummaries(inListOrder(index, JSON.parse(text))));
    });

    test("keeps each city in its country's folder", () => {
      for (const { country, city, network } of CITIES) expect(slugOf(network.meta.country), city).toBe(country);
    });
  });
});
