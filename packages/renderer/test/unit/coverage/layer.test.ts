import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/network/date.utils';
import type { CoverageCells } from '@railtime/network/facts.types';
import { SQUARE, TINY_WITH_HOLE as CITY } from '@railtime/network/testing/boundaries';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA } from '../../../src/coverage/layer.constants';
import { CoverageLayer } from '../../../src/coverage/layer.service';
import { coverageDrawing, coverageImage } from '../../../src/coverage/layer.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { playbackOf } from '../../support/playback.utils';

/** A city of 2 × 2 cells: one in each of two bands, one beyond them, one outside. */
const CELLS: CoverageCells = {
  columns: 2,
  rows: 2,
  corners: [
    [0, 1],
    [1, 1],
    [1, 0],
    [0, 0],
  ],
  bands: [
    { upTo: 400, label: 'near', color: '#0b7a75' },
    { upTo: 800, label: 'farther', color: '#1fa89f' },
  ],
  cells: Int8Array.from([0, 1, 2, -1]),
};

describe('CoverageLayer', () => {
  test('draws coverage given before the basemap loaded once installed', () => {
    const fake = fakeMap();
    const layer = new CoverageLayer(fake.map, () => 'data:image/png;base64,drawn');
    layer.update(coverageDrawing(CELLS, { ...SQUARE, polygons: [] }));
    expect(fake.layers.size).toBe(0);
    layer.install(['Font']);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['visible', 'visible']);
    expect(fake.images.get(SOURCES.coverageHeat)).toEqual({ url: 'data:image/png;base64,drawn', coordinates: CELLS.corners });
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

    const drawing = coverageDrawing(CELLS, SQUARE);
    layer.update(drawing);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['visible', 'visible']);
    expect(fake.images.get(SOURCES.coverageHeat)).toEqual({ url: 'data:image/png;base64,drawn', coordinates: CELLS.corners });
    expect(fake.data.get(SOURCES.coverageOutline)).toEqual({ type: 'FeatureCollection', features: drawing.outline });
    expect(pictures).toEqual([4]);

    layer.update(null);
    expect([LAYERS.coverageHeat, LAYERS.coverageOutline].map(id => fake.layers.get(id)?.layout.visibility)).toEqual(['none', 'none']);
    expect(pictures).toHaveLength(1);
  });
});

describe('CoverageLayerUtils', () => {
  describe('coverageImage', () => {
    test("colours each cell in its band's colour, tints the rest of the city, and leaves outside it clear", () => {
      const pixels = coverageImage(CELLS);
      const pixelAt = (cell: number) => [...pixels.slice(cell * 4, cell * 4 + 4)];
      expect(pixelAt(0)).toEqual([0x0b, 0x7a, 0x75, COVERAGE_ALPHA]);
      expect(pixelAt(1)).toEqual([0x1f, 0xa8, 0x9f, COVERAGE_ALPHA]);
      expect(pixelAt(2)).toEqual([0x80, 0x80, 0x80, UNCOVERED_ALPHA]);
      expect(pixelAt(3)).toEqual([0, 0, 0, 0]);
    });
  });

  describe('coverageDrawing', () => {
    test("draws the city's picture where it lies, and every ring of the outline", () => {
      const { facts, timeline } = playbackOf(tinyNetwork());
      const cells = facts.coverage(CITY).cells(timeline.cursorAt(toTimestamp('1915-01-01')));
      const drawing = coverageDrawing(cells, CITY);
      expect(drawing.image).toEqual({ width: cells.columns, height: cells.rows, pixels: coverageImage(cells) });
      expect(drawing.corners).toEqual(cells.corners);
      expect(drawing.outline.map(feature => feature.geometry.coordinates)).toEqual(CITY.polygons[0]);
    });
  });
});
