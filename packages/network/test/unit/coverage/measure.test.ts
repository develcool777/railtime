import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CoverageGrid } from '../../../src/coverage/grid.service';
import { COVERAGE_BANDS, COVERAGE_HEADLINE_METRES } from '../../../src/coverage/measure.constants';
import { CoverageMeasure } from '../../../src/coverage/measure.service';
import { bandAt, coverageHistory, coverageOf, servedStations } from '../../../src/coverage/measure.utils';
import { AROUND_TINY, HOLED, KM_EAST, KM_NORTH, MIDDLE, SQUARE, TINY_WITH_HOLE as CITY } from '../../support/factories/boundaries.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { modelOf } from '../../support/model.utils';

describe('CoverageMeasure', () => {
  test("measures the city on the network at a cursor, named by its outline, as the grid's helpers do", () => {
    const { index, timeline } = modelOf(tinyNetwork());
    const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
    const grid = new CoverageGrid(CITY);
    const cursor = timeline.cursorAt(toTimestamp('1915-01-01'));
    const distances = grid.distances(servedStations(index, timeline, cursor), COVERAGE_BANDS.at(-1)!.upTo);
    expect(measure.info(cursor)).toEqual({ name: 'Tiny', source: 'test', ...coverageOf(grid, distances, COVERAGE_BANDS, COVERAGE_HEADLINE_METRES) });
    // Before the first line, nothing is near a station.
    expect(measure.info(0).share).toBe(0);
  });

  test('works out the history from the timeline’s first year to today’s once, and frames the city', () => {
    const { index, timeline } = modelOf(tinyNetwork());
    const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
    const history = measure.history();
    const first = new Date(timeline.start).getUTCFullYear();
    expect(history).toEqual(coverageHistory(index, timeline, new CoverageGrid(CITY), [first, 1925], COVERAGE_HEADLINE_METRES));
    expect(measure.history()).toBe(history);
    expect(measure.bounds).toEqual([
      [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
    ]);
  });
});

describe('MeasureUtils', () => {
  describe('bandAt', () => {
    test('puts a distance in the first band it fits, its end included, and none beyond them', () => {
      expect([0, 400, 401, 800, 1200, 1201, Infinity].map(metres => bandAt(metres, COVERAGE_BANDS))).toEqual([0, 0, 1, 1, 2, -1, -1]);
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
      expect([coverage.share, coverage.beyond.share, ...coverage.bands.map(band => band.share)]).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe('servedStations', () => {
    test('places the stations a line calls at, not one it only passes', () => {
      const { index, timeline } = modelOf(tinyNetwork());
      // In 1915 red runs through C, which opens on it only in 1920.
      expect(servedStations(index, timeline, timeline.cursorAt(toTimestamp('1915-01-01')))).toEqual(['a', 'b', 'd'].map(station => index.coordOf(station)));
    });
  });

  describe('coverageHistory', () => {
    test('measures the covered share at the end of each year, growing with the network', () => {
      const { index, timeline } = modelOf(tinyNetwork());
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
      const { index, timeline } = modelOf(tinyNetwork());
      const grid = new CoverageGrid(AROUND_TINY);
      for (const first of [1899, 1900, 1901, 1905, 1915]) {
        const history = coverageHistory(index, timeline, grid, [first, 1925], 800);
        const expected = history.map(({ year }) => {
          const cursor = timeline.cursorAt(Date.UTC(year, 11, 31));
          return coverageOf(grid, grid.distances(servedStations(index, timeline, cursor), 1200), COVERAGE_BANDS, 800).share;
        });
        history.forEach(({ share }, position) => expect(share).toBeCloseTo(expected[position]!, 9));
      }
    });

    test('shares nothing out of a city with no area', () => {
      const { index, timeline } = modelOf(tinyNetwork());
      const history = coverageHistory(index, timeline, new CoverageGrid({ ...AROUND_TINY, polygons: [] }), [1899, 1925], 800);
      expect(history.every(entry => entry.share === 0)).toBe(true);
    });
  });
});
