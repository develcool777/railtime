import type { LngLat } from '@railtime/core/geometry.types';
import { required } from '@railtime/core/required.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { parseBoundary } from '@railtime/schema/boundary.schema';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { MIN_STATIONS_HELD, USER_AGENT } from '../../../src/boundary/boundary.constants.ts';
import type { NominatimPlace } from '../../../src/boundary/boundary.types.ts';
import { boundaryArgsOf, boundaryOf, fetchBoundary, fetchBoundaries, formatBoundary, lookupUrlOf, relationOf } from '../../../src/boundary/boundary.utils.ts';
import { cities, citiesNamed, readNetwork } from '../../../src/city.utils.ts';
import { cityApart } from '../../support/folders.utils.ts';

/**
 * A closed square ring.
 *
 * @param west - Its west edge.
 * @param south - Its south edge.
 * @param size - Its side, degrees.
 * @returns The ring.
 */
const square = (west: number, south: number, size: number): LngLat[] => [
  [west, south],
  [west + size, south],
  [west + size, south + size],
  [west, south + size],
  [west, south],
];

/** A city 10° a side with a 2° hole, and an island apart from it. */
const CITY: CityBoundary = {
  name: 'Test',
  source: '© OpenStreetMap contributors, relation 42',
  polygons: [[square(0, 0, 10), square(4, 4, 2)], [square(20, 0, 1)]],
};

describe('BoundaryUtils', () => {
  describe('relationOf', () => {
    test('reads the relation an outline names, or none', () => {
      expect(relationOf(CITY)).toBe(42);
      expect(relationOf({ source: 'drawn by hand' })).toBeNull();
    });
  });

  describe('lookupUrlOf', () => {
    test("asks Nominatim for a relation's outline, simplified, with its names", () => {
      expect(lookupUrlOf(175_342)).toBe(
        'https://nominatim.openstreetmap.org/lookup?osm_ids=R175342&format=json&polygon_geojson=1&polygon_threshold=0.0005&namedetails=1',
      );
    });
  });

  describe('boundaryOf', () => {
    const place = (geojson: NominatimPlace['geojson'], namedetails?: Record<string, string>): NominatimPlace => ({
      osm_id: 7,
      name: 'Київ',
      ...(namedetails && { namedetails }),
      geojson,
    });

    test('takes a polygon or several, rounded to about a metre, its source the relation', () => {
      const ring: LngLat[] = [
        [30.123456, 50.123454],
        [30.2, 50.1],
        [30.2, 50.2],
        [30.123456, 50.123454],
      ];
      expect(boundaryOf(place({ type: 'Polygon', coordinates: [ring] }))).toEqual({
        name: 'Київ',
        source: '© OpenStreetMap contributors, relation 7',
        polygons: [
          [
            [
              [30.12346, 50.12345],
              [30.2, 50.1],
              [30.2, 50.2],
              [30.12346, 50.12345],
            ],
          ],
        ],
      });
      expect(boundaryOf(place({ type: 'MultiPolygon', coordinates: [[ring], [ring]] })).polygons).toHaveLength(2);
    });

    test('rounds a point half way up, as the outlines kept were', () => {
      const ring: LngLat[] = [
        [1.000015, 2.000025],
        [1.1, 2],
        [1.1, 2.1],
        [1.000015, 2.000025],
      ];
      expect(boundaryOf(place({ type: 'Polygon', coordinates: [ring] })).polygons[0]?.[0]?.[0]).toEqual([1.00002, 2.00003]);
    });

    test('is named as asked, else in English, else in its own language', () => {
      const geojson = { type: 'Polygon' as const, coordinates: [square(0, 0, 1)] };
      expect(boundaryOf(place(geojson, { 'name:en': 'Kyiv' }), 'Kyiv City').name).toBe('Kyiv City');
      expect(boundaryOf(place(geojson, { 'name:en': 'Kyiv' })).name).toBe('Kyiv');
      expect(boundaryOf(place(geojson)).name).toBe('Київ');
    });

    test('refuses a relation with no area', () => {
      expect(() => boundaryOf(place({ type: 'LineString' }))).toThrow('relation 7 is a LineString, not an area');
    });
  });

  describe('formatBoundary', () => {
    test('writes a ring to a line, and reads back as it was', () => {
      const text = formatBoundary(CITY);
      expect(parseBoundary(JSON.parse(text))).toEqual(CITY);
      expect(text.split('\n').slice(0, 6)).toEqual([
        '{',
        '  "name": "Test",',
        '  "source": "© OpenStreetMap contributors, relation 42",',
        '  "polygons": [',
        '    [',
        `      ${JSON.stringify(square(0, 0, 10))},`,
      ]);
      expect(text.endsWith('  ]\n}\n')).toBe(true);
    });
  });

  describe('boundaryArgsOf', () => {
    test('takes every city, a city, or a city and its relation', () => {
      expect(boundaryArgsOf([])).toEqual({ city: undefined, relation: null });
      expect(boundaryArgsOf(['london'])).toEqual({ city: 'london', relation: null });
      expect(boundaryArgsOf(['london', '175342'])).toEqual({ city: 'london', relation: 175_342 });
    });

    test('refuses a relation that is not a whole number above 0, and more than two arguments', () => {
      for (const relation of ['x1', '0', '1.5'])
        expect(() => boundaryArgsOf(['london', relation])).toThrow(`a relation is a whole number above 0, not ${relation}`);
      expect(() => boundaryArgsOf(['london', '1', 'more'])).toThrow('more arguments than a city and its relation');
    });
  });

  /** The city the outlines are fetched for. */
  const KYIV = required(citiesNamed('kyiv')[0], 'kyiv');

  /**
   * Nominatim, answering every lookup with the same response.
   *
   * @param body - What it answers.
   * @param status - Its HTTP status.
   * @returns The stand-in `fetch`, stubbed as the global.
   */
  const nominatimAnswering = (body: unknown, status = 200) => {
    const answer = vi.fn(async () => Response.json(body, { status }));
    vi.stubGlobal('fetch', answer);
    return answer;
  };

  /**
   * Kyiv, moved into a folder of the test's own, so a test writes no city's file.
   *
   * @param kept - Its outline there at first; none without.
   * @returns The city, and its outline's file as it stands.
   */
  const kyivApart = (kept?: CityBoundary) => {
    const city = cityApart('kyiv');
    if (kept) writeFileSync(city.boundaryPath, formatBoundary(kept));
    return { city, written: () => (existsSync(city.boundaryPath) ? readFileSync(city.boundaryPath, 'utf8') : null) };
  };

  /** Kyiv's outline, as kept. */
  const KYIV_OUTLINE = parseBoundary(JSON.parse(readFileSync(KYIV.boundaryPath, 'utf8')));

  /** Nominatim's answer for Kyiv's relation: its outline, under its own name. */
  const KYIV_PLACE: NominatimPlace = {
    osm_id: relationOf(KYIV_OUTLINE) ?? 0,
    name: 'Київ',
    namedetails: { 'name:en': 'Kyiv' },
    geojson: { type: 'MultiPolygon', coordinates: KYIV_OUTLINE.polygons },
  };

  describe('fetchBoundary', () => {
    test('writes the outline of the relation the kept one names, as the project asks, keeping the name it was given, and says so', async () => {
      const { city, written } = kyivApart({ ...KYIV_OUTLINE, name: 'Kyiv city', polygons: [[square(30, 50, 1)]] });
      const answer = nominatimAnswering([KYIV_PLACE]);
      const said = vi.fn();
      await fetchBoundary(city, null, said);
      expect(answer).toHaveBeenCalledExactlyOnceWith(lookupUrlOf(KYIV_PLACE.osm_id), { headers: { 'User-Agent': USER_AGENT } });
      expect(written()).toBe(formatBoundary({ ...KYIV_OUTLINE, name: 'Kyiv city' }));
      expect(said).toHaveBeenCalledWith(expect.stringMatching(/^kyiv: Kyiv city, relation \d+, \d+ points, \d+% of its stations, written$/));
      await fetchBoundary(city, null, said);
      expect(said).toHaveBeenLastCalledWith(expect.stringMatching(/, unchanged$/));
    });

    test('names a new outline as OpenStreetMap does in English, for another relation or none kept', async () => {
      const { city, written } = kyivApart();
      nominatimAnswering([KYIV_PLACE]);
      await fetchBoundary(city, KYIV_PLACE.osm_id, vi.fn());
      expect(parseBoundary(JSON.parse(written() ?? ''))).toMatchObject({ name: 'Kyiv' });
    });

    test('asks for a relation for a city with no outline yet, asking Nominatim nothing', async () => {
      const { city } = kyivApart();
      const answer = nominatimAnswering([KYIV_PLACE]);
      await expect(fetchBoundary(city, null, vi.fn())).rejects.toThrow('kyiv has no outline yet: give its relation');
      expect(answer).not.toHaveBeenCalled();
    });

    test.each([
      { answer: 'an error', body: [], status: 500, reason: 'relation 9 not fetched: Nominatim answered 500' },
      { answer: 'no place', body: [], status: 200, reason: 'relation 9 not found on OpenStreetMap' },
      {
        answer: 'a line',
        body: [{ osm_id: 9, name: 'Line', geojson: { type: 'LineString' } }],
        status: 200,
        reason: "relation 9 is a LineString, not an area: look for the city's administrative boundary",
      },
      {
        answer: 'an outline holding none of its stations',
        body: [{ osm_id: 9, name: 'Elsewhere', geojson: { type: 'Polygon', coordinates: [square(0, 0, 1)] } }],
        status: 200,
        reason: "relation 9 holds 0% of the city's stations: is it the city's own?",
      },
    ])('writes nothing for $answer, and says why', async ({ body, status, reason }) => {
      const { city, written } = kyivApart(KYIV_OUTLINE);
      const before = written();
      nominatimAnswering(body, status);
      await expect(fetchBoundary(city, 9, vi.fn())).rejects.toThrow(reason);
      expect(written()).toBe(before);
    });
  });

  describe('fetchBoundaries', () => {
    test('refuses a city it does not know, and a relation for every city, asking Nominatim nothing', async () => {
      const answer = nominatimAnswering([]);
      await expect(fetchBoundaries('atlantis', null, vi.fn())).rejects.toThrow('no city atlantis');
      await expect(fetchBoundaries(undefined, 42, vi.fn())).rejects.toThrow('a relation is of one city: name it');
      expect(answer).not.toHaveBeenCalled();
    });

    test('says why a city was not written, and names it', async () => {
      nominatimAnswering([], 503);
      const said = vi.fn();
      await expect(fetchBoundaries('kyiv', null, said)).rejects.toThrow('outlines not written: kyiv');
      expect(said).toHaveBeenCalledExactlyOnceWith(`kyiv: not written: relation ${relationOf(KYIV_OUTLINE)} not fetched: Nominatim answered 503`);
    });
  });

  describe("every city's outline", () => {
    test('is there for every city (pnpm data:boundary <city> <relation>)', () => {
      expect(cities().filter(city => !existsSync(city.boundaryPath))).toEqual([]);
    });

    test.each(cities().map(city => ({ name: `${city.country}/${city.id}`, city })))(
      "$name: valid, kept in its layout, and holding most of its stations: its own city's",
      ({ city }) => {
        const text = readFileSync(city.boundaryPath, 'utf8');
        const boundary = parseBoundary(JSON.parse(text));
        expect(formatBoundary(boundary)).toBe(text);
        expect(NetworkFacts.create(readNetwork(city)).coverage(boundary).stationsHeld()).toBeGreaterThan(MIN_STATIONS_HELD);
      },
    );
  });
});
