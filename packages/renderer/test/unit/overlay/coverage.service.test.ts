import type { CoverageCells } from '@railtime/network/facts.types';
import { SQUARE } from '@railtime/network/testing/boundaries';
import { describe, expect, test } from 'vitest';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { CoverageLayer } from '../../../src/overlay/coverage.service';
import { coverageDrawing } from '../../../src/overlay/overlay.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';

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
