import type { CityBoundary } from '@railtime/schema/boundary.types';
import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CoverageGrid } from '../../../src/coverage/grid.service';
import { COVERAGE_ALPHA, COVERAGE_BANDS, UNCOVERED_ALPHA } from '../../../src/coverage/layer.constants';
import { CoverageLayer } from '../../../src/coverage/layer.service';
import { bandAt, coverageHistory, coverageImage, coverageOf, servedStations } from '../../../src/coverage/layer.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

/** Degrees of longitude and latitude in a km, at 51.5° north. */
const KM_EAST = 0.0144;
const KM_NORTH = 1 / 110.57;

/** A 2 km square city, its middle 1 km east and north of 0°, 51.5°, with a station there. */
const SQUARE: CityBoundary = {
  name: 'Square',
  source: 'test',
  polygons: [
    [
      [
        [0, 51.5],
        [2 * KM_EAST, 51.5],
        [2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [0, 51.5 + 2 * KM_NORTH],
        [0, 51.5],
      ],
    ],
  ],
};
const MIDDLE: [number, number] = [KM_EAST, 51.5 + KM_NORTH];

/** The square with a 500 m square hole at its south-west corner. */
const HOLED: CityBoundary = {
  ...SQUARE,
  polygons: [[...SQUARE.polygons[0]!, SQUARE.polygons[0]![0]!.map(([east, north]) => [east / 4, 51.5 + (north - 51.5) / 4] as [number, number])]],
};

/** A city round the tiny network: A to D, 0 to 3 km east, with 2 km to spare all round. */
const AROUND_TINY: CityBoundary = {
  name: 'Tiny',
  source: 'test',
  polygons: [
    [
      [
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      ],
    ],
  ],
};

describe('CoverageLayer', () => {
  test('draws coverage given before the basemap loaded once installed', () => {
    const fake = fakeMap();
    const layer = new CoverageLayer(fake.map, () => 'data:image/png;base64,drawn');
    const grid = new CoverageGrid(SQUARE);
    const pixels = coverageImage(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS);
    layer.update({ image: { width: grid.columns, height: grid.rows, pixels }, corners: grid.corners, outline: [] });
    expect(fake.layers.size).toBe(0);
    layer.install(['Font']);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['visible', 'visible']);
    expect(fake.images.get(SOURCES.coverageHeat)).toEqual({ url: 'data:image/png;base64,drawn', coordinates: grid.corners });
  });

  test('adds the heatmap and the outline hidden, draws them, and hides them again', () => {
    const fake = fakeMap();
    const pictures: number[] = [];
    const layer = new CoverageLayer(fake.map, image => {
      pictures.push(image.width * image.height);
      return 'data:image/png;base64,drawn';
    });
    layer.install(['Font']);
    layer.applyPalette(PALETTES.dark);
    expect(fake.layers.get(LAYERS.coverageOutline)?.paint['line-color']).toBe(PALETTES.dark.label);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['none', 'none']);

    const grid = new CoverageGrid(SQUARE);
    const outline = SQUARE.polygons[0]!.map(ring => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: ring },
    }));
    const pixels = coverageImage(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS);
    layer.update({ image: { width: grid.columns, height: grid.rows, pixels }, corners: grid.corners, outline });
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['visible', 'visible']);
    expect(fake.images.get(SOURCES.coverageHeat)).toEqual({ url: 'data:image/png;base64,drawn', coordinates: grid.corners });
    expect(fake.data.get(SOURCES.coverageOutline)).toEqual({ type: 'FeatureCollection', features: outline });
    expect(pictures).toEqual([400]);

    layer.update(null);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['none', 'none']);
    expect(pictures).toHaveLength(1);
  });
});

describe('CoverageLayerUtils', () => {
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

  describe('coverageImage', () => {
    test("colours each cell in its band's colour, tints the rest of the city, and leaves outside it clear", () => {
      const grid = new CoverageGrid(HOLED);
      const pixels = coverageImage(grid, grid.distances([MIDDLE], 1200), COVERAGE_BANDS);
      const pixelAt = (east: number, north: number) => {
        const cell = Math.floor((2 - north) / 0.1) * grid.columns + Math.floor(east / 0.1);
        return [...pixels.slice(cell * 4, cell * 4 + 4)];
      };
      expect(pixelAt(1.05, 1.05)).toEqual([0x0b, 0x7a, 0x75, COVERAGE_ALPHA]);
      expect(pixelAt(1.65, 1.05)).toEqual([0x1f, 0xa8, 0x9f, COVERAGE_ALPHA]);
      // The north-east corner, 1.3 km from the middle: city, but beyond every band.
      expect(pixelAt(1.95, 1.95)).toEqual([0x80, 0x80, 0x80, UNCOVERED_ALPHA]);
      // The hole in the south-west: not the city.
      expect(pixelAt(0.15, 0.15)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('servedStations', () => {
    test('places the stations a line calls at, not one it only passes', () => {
      const { index, timeline } = playbackOf(tinyNetwork());
      // In 1915 red runs through C, which opens on it only in 1920.
      expect(servedStations(index, timeline, timeline.cursorAt(toTimestamp('1915-01-01')))).toEqual(['a', 'b', 'd'].map(station => index.coordOf(station)));
    });
  });

  describe('coverageHistory', () => {
    test('measures the covered share at the end of each year, growing with the network', () => {
      const { index, timeline } = playbackOf(tinyNetwork());
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
      const { index, timeline } = playbackOf(tinyNetwork());
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
      const { index, timeline } = playbackOf(tinyNetwork());
      const history = coverageHistory(index, timeline, new CoverageGrid({ ...AROUND_TINY, polygons: [] }), [1899, 1925], 800);
      expect(history.every(entry => entry.share === 0)).toBe(true);
    });
  });
});
