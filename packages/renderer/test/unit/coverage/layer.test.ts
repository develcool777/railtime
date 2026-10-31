import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/network/date.utils';
import { CoverageGrid } from '@railtime/network/grid.service';
import { COVERAGE_BANDS } from '@railtime/network/coverage.constants';
import { CoverageMeasure } from '@railtime/network/coverage.service';
import { servedStations } from '@railtime/network/coverage.utils';
import { HOLED, MIDDLE, SQUARE, TINY_WITH_HOLE as CITY } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA } from '../../../src/coverage/layer.constants';
import { CoverageLayer } from '../../../src/coverage/layer.service';
import { coverageDrawing, coverageImage } from '../../../src/coverage/layer.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { playbackOf } from '../../support/playback.utils';

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

  describe('coverageDrawing', () => {
    test("draws the grid's picture where it lies, and every ring of the outline", () => {
      const { index, timeline } = playbackOf(tinyNetwork());
      const measure = new CoverageMeasure(CITY, index, timeline, toTimestamp('1925-06-01'));
      const grid = new CoverageGrid(CITY);
      const cursor = timeline.cursorAt(toTimestamp('1915-01-01'));
      const drawing = coverageDrawing(measure, cursor);
      const distances = grid.distances(servedStations(index, timeline, cursor), COVERAGE_BANDS.at(-1)!.upTo);
      expect(drawing.image).toEqual({ width: grid.columns, height: grid.rows, pixels: coverageImage(grid, distances, COVERAGE_BANDS) });
      expect(drawing.corners).toEqual(grid.corners);
      expect(drawing.outline.map(feature => feature.geometry.coordinates)).toEqual(CITY.polygons[0]);
    });
  });
});
