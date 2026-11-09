import { keysOf } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { required } from '@railtime/core/required.utils';
import { slugOf } from '@railtime/core/text.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { CityIndex } from '@railtime/schema/cityIndex.types';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { SUMMARIES_PATH, cities, citiesNamed, readNetwork } from '../../../src/city.utils.ts';
import { SUMMARY_DAY } from '../../../src/summary/summary.constants.ts';
import { formatSummaries, inListOrder, summaryOf, writeSummaries } from '../../../src/summary/summary.utils.ts';
import { folderApart } from '../../support/folders.utils.ts';

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
      expect(entry.plans).toBe(keysOf(network.plans ?? {}).length);
    });

    test('counts as of its stated day, whatever the clock says: a change dated in between moves nothing', () => {
      const network = tinyNetwork();
      vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(1950, 0, 1) });
      onTestFinished(() => {
        vi.useRealTimers();
      });
      const before = summaryOf(network);
      vi.setSystemTime(Date.UTC(1990, 0, 1));
      expect(summaryOf(network)).toEqual(before);
      expect(before).toMatchObject({ lines: NetworkFacts.create(network, { today: toTimestamp(SUMMARY_DAY) }).summary().lines });
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
      expect(keysOf(inListOrder(summaries, previous))).toEqual(['first', 'second', 'added', 'third', 'new']);
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

  describe('writeSummaries', () => {
    /** Two cities, in the order they are found. */
    const FOUND = ['kyiv', 'london'].map(id => required(citiesNamed(id)[0], id));

    /**
     * Where a test's list is written, in a folder of its own.
     *
     * @returns The file's path.
     */
    const listApart = () => {
      return join(folderApart(), 'cities.json');
    };

    test('writes every city summed up, in the order found, and says how many', () => {
      const path = listApart();
      const said = vi.fn();
      writeSummaries(said, FOUND, path);
      expect(readFileSync(path, 'utf8')).toBe(formatSummaries({ kyiv: summaryOf(cityOf('kyiv').network), london: summaryOf(cityOf('london').network) }));
      expect(said).toHaveBeenCalledWith(`${path}: 2 cities`);
    });

    test('keeps the order the list had', () => {
      const path = listApart();
      writeFileSync(path, formatSummaries({ london: summaryOf(cityOf('london').network), kyiv: summaryOf(cityOf('kyiv').network) }));
      writeSummaries(vi.fn(), FOUND, path);
      expect(keysOf(JSON.parse(readFileSync(path, 'utf8')))).toEqual(['london', 'kyiv']);
    });

    test("refuses a city outside its country's folder, and writes nothing", () => {
      const path = listApart();
      const [kyiv] = FOUND;
      const astray = { ...required(kyiv, 'kyiv'), country: 'poland' };
      expect(() => writeSummaries(vi.fn(), [astray], path)).toThrow(`${astray.networkPath}: its country, Ukraine, is not its folder's`);
      expect(existsSync(path)).toBe(false);
    });
  });
});
