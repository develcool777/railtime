import { parseBoundary } from '@railtime/schema/boundary.schema';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network, Station } from '@railtime/schema/network.types';
import type { LngLat } from '@railtime/core/geometry.types';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { cities, readNetwork } from '../../../src/city.utils.ts';
import { MIN_STATIONS_HELD } from '../../../src/boundary/boundary.constants.ts';
import type { NominatimPlace } from '../../../src/boundary/boundary.types.ts';
import { boundaryArgsOf, boundaryOf, formatBoundary, holds, lookupUrlOf, relationOf, stationsHeld } from '../../../src/boundary/boundary.utils.ts';

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

/**
 * Stations at points.
 *
 * @param points - Where they stand.
 * @returns The stations, by id.
 */
const stationsAt = (...points: LngLat[]): Record<string, Station> =>
  Object.fromEntries(points.map((coordinate, position) => [`s${position}`, { name: `S${position}`, coordinate }]));

/**
 * A network of stations built, and a plan's.
 *
 * @param built - The stations built.
 * @param planned - A plan's stations.
 * @returns The network.
 */
const networkOf = (built: Record<string, Station>, planned: Record<string, Station> = {}): Network => ({
  meta: { city: 'Test', start: '1900-01-01', built: '2026-01-01', attribution: 'test' },
  networks: {},
  lines: {},
  stations: built,
  segments: [],
  plans: { plan: { name: 'Plan', status: 'proposed', stations: planned, sections: [] } },
});

describe('BoundaryUtils', () => {
  describe('holds', () => {
    test('holds a point in a polygon, not one in its hole or between polygons', () => {
      expect(
        [
          [1, 1],
          [5, 5],
          [15, 5],
          [20.5, 0.5],
          [-1, 5],
        ].map(point => holds(CITY, point as LngLat)),
      ).toEqual([true, false, false, true, false]);
    });
  });

  describe('stationsHeld', () => {
    test('shares out the stations built, else the plans’, and none of no stations', () => {
      expect(stationsHeld(CITY, networkOf(stationsAt([1, 1], [2, 2], [5, 5], [30, 30])))).toBe(0.5);
      expect(stationsHeld(CITY, networkOf({}, stationsAt([1, 1], [30, 30], [31, 31], [32, 32])))).toBe(0.25);
      expect(stationsHeld(CITY, networkOf({}))).toBe(0);
    });
  });

  describe('relationOf', () => {
    test('reads the relation an outline names, or none', () => {
      expect(relationOf(CITY)).toBe(42);
      expect(relationOf({ source: 'drawn by hand' })).toBeNull();
    });
  });

  describe('lookupUrlOf', () => {
    test("asks Nominatim for a relation's outline, simplified, with its names", () => {
      expect(lookupUrlOf(175342)).toBe(
        'https://nominatim.openstreetmap.org/lookup?osm_ids=R175342&format=json&polygon_geojson=1&polygon_threshold=0.0005&namedetails=1',
      );
    });
  });

  describe('boundaryOf', () => {
    const place = (geojson: NominatimPlace['geojson'], namedetails?: Record<string, string>): NominatimPlace => ({
      osm_id: 7,
      name: 'Київ',
      namedetails,
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
      expect(boundaryArgsOf(['london', '175342'])).toEqual({ city: 'london', relation: 175342 });
    });

    test('refuses a relation that is not a whole number above 0, and more than two arguments, with the usage', () => {
      for (const args of [
        ['london', 'x1'],
        ['london', '0'],
        ['london', '1.5'],
        ['london', '1', 'more'],
      ])
        expect(() => boundaryArgsOf(args)).toThrow('usage: pnpm data:boundary [city [relation]]');
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
        expect(stationsHeld(boundary, readNetwork(city))).toBeGreaterThan(MIN_STATIONS_HELD);
      },
    );
  });
});
