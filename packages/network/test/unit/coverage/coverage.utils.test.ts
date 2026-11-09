import { toTimestamp } from '@railtime/core/date.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { COVERAGE_BANDS } from '../../../src/coverage/coverage.constants';
import { CoverageGrid } from '../../../src/coverage/coverage.service';
import { bandAt, bandsWithin, cellBands, coverageHistory, coverageOf, crossingsOf, holds, servedStations } from '../../../src/coverage/coverage.utils';
import { engineOf } from '../../../src/engine/engine.utils';
import { AROUND_TINY, HOLED, KM_EAST, KM_NORTH, MIDDLE, SQUARE } from '../../support/factories/boundaries.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

/** Where the test cities start: off the prime meridian, so a west edge of 0° hides no sign. */
const WEST = 2;

/**
 * A point km east and north of 2°, 51.5°.
 *
 * @param east - Km east.
 * @param north - Km north.
 * @returns The point.
 */
const placeAt = (east: number, north: number): LngLat => [WEST + east * KM_EAST, 51.5 + north * KM_NORTH];

/**
 * A square ring, `size` km a side, its south-west corner `east` and `north` km from 2°, 51.5°.
 *
 * @param size - Its side, km.
 * @param east - Km east of 2°.
 * @param north - Km north of 51.5°.
 * @returns The ring, closed.
 */
const square = (size: number, east = 0, north = 0): LngLat[] => {
  const [west, south] = placeAt(east, north);
  const [eastEdge, northEdge] = [west + size * KM_EAST, south + size * KM_NORTH];
  return [
    [west, south],
    [eastEdge, south],
    [eastEdge, northEdge],
    [west, northEdge],
    [west, south],
  ];
};

/**
 * A city of polygons.
 *
 * @param polygons - Its polygons, each its rings.
 * @returns The outline.
 */
const cityOf = (...polygons: LngLat[][][]): CityBoundary => ({ name: 'Test', source: 'test', polygons });

describe('CoverageUtils', () => {
  describe('crossingsOf', () => {
    test("is each place a ring's edges cross a latitude, none above or below it", () => {
      const ring = square(2);
      const [west, south] = placeAt(0, 0);
      const crossings = crossingsOf(ring, south + KM_NORTH);
      expect(crossings).toEqual([expect.closeTo(west + 2 * KM_EAST), expect.closeTo(west)]);
      expect(crossingsOf(ring, south - KM_NORTH)).toEqual([]);
      expect(crossingsOf(ring, south + 3 * KM_NORTH)).toEqual([]);
    });
  });

  describe('holds', () => {
    /** A 10 km city with a 2 km hole, and an island apart from it. */
    const ISLANDS = cityOf([square(10), square(2, 4, 4)], [square(1, 20)]);

    test('holds a point in a polygon, not one in its hole or between polygons', () => {
      const places = [placeAt(1, 1), placeAt(5, 5), placeAt(15, 5), placeAt(20.5, 0.5), placeAt(-1, 5)];
      expect(places.map(place => holds(ISLANDS, place))).toEqual([true, false, false, true, false]);
    });
  });

  describe('bandsWithin', () => {
    test('takes the bands up to a distance, each ending at or before it', () => {
      expect(bandsWithin(COVERAGE_BANDS, 400).map(band => band.upTo)).toEqual([400]);
      expect(bandsWithin(COVERAGE_BANDS, 800).map(band => band.upTo)).toEqual([400, 800]);
      expect(bandsWithin(COVERAGE_BANDS, 1200).map(band => band.upTo)).toEqual([400, 800, 1200]);
      expect(bandsWithin(COVERAGE_BANDS, 2000)).toEqual(COVERAGE_BANDS);
    });
  });

  describe('bandAt', () => {
    test('puts a distance in the first band it fits, its end included, and none beyond them', () => {
      expect([0, 400, 401, 800, 1200, 1201, 1600, 2000, 2001, Infinity].map(metres => bandAt(metres, COVERAGE_BANDS))).toEqual([
        0, 0, 1, 1, 2, 3, 3, 4, -1, -1,
      ]);
    });
  });

  describe('cellBands', () => {
    test('gives each cell of the city its band, the city beyond every band one more, and outside it -1', () => {
      const grid = new CoverageGrid(HOLED);
      const cells = cellBands(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS);
      const cellAt = (east: number, north: number) => cells[Math.floor((2 - north) / 0.1) * grid.columns + Math.floor(east / 0.1)];
      expect(cellAt(1.05, 1.05)).toBe(0);
      expect(cellAt(1.65, 1.05)).toBe(1);
      // The north-east corner, 1.3 km from the middle: city, but beyond every band.
      expect(cellAt(1.95, 1.95)).toBe(COVERAGE_BANDS.length);
      // The hole in the south-west: not the city.
      expect(cellAt(0.15, 0.15)).toBe(-1);
    });
  });

  describe('coverageOf', () => {
    test("shares the city's area out by band, the headline the bands within its distance", () => {
      const grid = new CoverageGrid(SQUARE);
      const coverage = coverageOf(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS, 800);
      const [near, middle, far] = coverage.bands;
      // Circles round the middle: π·0.4² of the 4 km², then the ring to 800 m; 1.2 km reaches past the sides.
      expect(near?.share).toBeCloseTo((Math.PI * 0.16) / 4, 1);
      expect(middle?.share).toBeCloseTo((Math.PI * 0.48) / 4, 1);
      expect(coverage.share).toBeCloseTo((near?.share ?? 0) + (middle?.share ?? 0), 9);
      expect((near?.share ?? 0) + (middle?.share ?? 0) + (far?.share ?? 0) + coverage.beyond.share).toBeCloseTo(1, 9);
      expect(coverage.beyond.share).toBeGreaterThan(0);
      expect(near?.km2).toBeCloseTo(Math.PI * 0.16, 1);
      expect(coverage).toMatchObject({ metres: 800, km2: grid.km2 });
    });

    test('covers nothing without a station', () => {
      const grid = new CoverageGrid(SQUARE);
      const coverage = coverageOf(grid, grid.distances([], 1200), COVERAGE_BANDS, 800);
      expect([coverage.share, coverage.beyond.share]).toEqual([0, 1]);
    });

    test("counts only the city's cells, not a hole's", () => {
      const grid = new CoverageGrid(HOLED);
      const coverage = coverageOf(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS, 800);
      const areas = [...coverage.bands.map(band => band.km2), coverage.beyond.km2];
      expect(areas.reduce((total, km2) => total + km2, 0)).toBeCloseTo(grid.km2, 9);
      // The square's 4 km² less the hole's quarter of a km².
      expect(grid.km2).toBeCloseTo(3.75, 1);
    });

    test('shares nothing out of a city with no area', () => {
      const grid = new CoverageGrid({ ...SQUARE, polygons: [] });
      const coverage = coverageOf(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS, 800);
      expect([coverage.share, coverage.beyond.share, ...coverage.bands.map(band => band.share)]).toEqual(
        Array.from({ length: 2 + COVERAGE_BANDS.length }, () => 0),
      );
    });
  });

  describe('servedStations', () => {
    test('places the stations a line calls at, not one it only passes', () => {
      const { index, timeline } = engineOf(factsOf(tinyNetwork()));
      // In 1915 red runs through C, which opens on it only in 1920.
      expect(servedStations(index, timeline, timeline.cursorAt(toTimestamp('1915-01-01')))).toEqual(
        ['a', 'b', 'd'].map(station => index.coordOf(stationId(station))),
      );
    });
  });

  describe('coverageHistory', () => {
    test('measures the covered share at the end of each year, growing with the network', () => {
      const { index, timeline } = engineOf(factsOf(tinyNetwork()));
      const history = coverageHistory(index, timeline, new CoverageGrid(AROUND_TINY), [1899, 1925], 800);
      expect(history.map(entry => entry.year)).toEqual(Array.from({ length: 27 }, (_, position) => 1899 + position));
      const share = (year: number) => history.find(entry => entry.year === year)!.share;
      expect(share(1899)).toBe(0);
      // A and B in 1900; D in 1910; C in 1920: each adds ground.
      expect(share(1900)).toBeGreaterThan(0);
      expect(share(1910)).toBeGreaterThan(share(1909));
      expect(share(1920)).toBeGreaterThan(share(1919));
      expect(share(1915)).toBe(share(1910));
    });

    test('gives each year the share coverageOf finds at its end, from any first year', () => {
      const { index, timeline } = engineOf(factsOf(tinyNetwork()));
      const grid = new CoverageGrid(AROUND_TINY);
      for (const first of [1899, 1900, 1901, 1905, 1915]) {
        const history = coverageHistory(index, timeline, grid, [first, 1925], 800);
        const expected = history.map(({ year }) => {
          const cursor = timeline.cursorAt(Date.UTC(year, 11, 31));
          return coverageOf(grid, grid.distances(servedStations(index, timeline, cursor), 1200), COVERAGE_BANDS, 800).share;
        });
        for (const [position, { share }] of history.entries()) expect(share).toBeCloseTo(expected[position]!, 9);
      }
    });

    test('shares nothing out of a city with no area', () => {
      const { index, timeline } = engineOf(factsOf(tinyNetwork()));
      const history = coverageHistory(index, timeline, new CoverageGrid({ ...AROUND_TINY, polygons: [] }), [1899, 1925], 800);
      expect(history.every(entry => entry.share === 0)).toBe(true);
    });
  });
});
