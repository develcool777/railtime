import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { BASEMAP_BUILDINGS } from '../../../src/buildings/layer.constants';
import { BuildingsLayer } from '../../../src/buildings/layer.service';
import { LAYERS } from '../../../src/layers/ids.constants';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';

/** A basemap with buildings, as the default one has. */
const WITH_BUILDINGS: LayerSpecification[] = [
  { id: 'building', type: 'fill', source: BASEMAP_BUILDINGS.source, 'source-layer': BASEMAP_BUILDINGS.sourceLayer, paint: {} },
];

describe('BuildingsLayer', () => {
  test("stands the basemap's buildings up, rising with the zoom, coloured as its built-up ground, and lays them down", () => {
    const fake = fakeMap(WITH_BUILDINGS);
    const layer = new BuildingsLayer(fake.map);
    layer.install(['Font']);
    layer.applyPalette(PALETTES.dark);
    const buildings = fake.layers.get(LAYERS.buildings);
    expect(buildings).toMatchObject({ type: 'fill-extrusion', source: BASEMAP_BUILDINGS.source, 'source-layer': BASEMAP_BUILDINGS.sourceLayer });
    expect(buildings?.layout.visibility).toBe('none');
    expect(buildings?.paint['fill-extrusion-color']).toBe(PALETTES.dark.landuse);
    expect(buildings?.paint['fill-extrusion-height']).toEqual(['interpolate', ['linear'], ['zoom'], 13, 0, 15, ['get', 'render_height']]);
    layer.show(true);
    expect(buildings?.layout.visibility).toBe('visible');
    layer.show(false);
    expect(buildings?.layout.visibility).toBe('none');
  });

  test('stands them as it is installed if the map is already seen in 3D', () => {
    const fake = fakeMap(WITH_BUILDINGS);
    const layer = new BuildingsLayer(fake.map);
    layer.show(true);
    layer.install(['Font']);
    expect(fake.layers.get(LAYERS.buildings)?.layout.visibility).toBe('visible');
  });

  test('has none on a basemap without buildings, and asks nothing of it', () => {
    const fake = fakeMap();
    const layer = new BuildingsLayer(fake.map);
    layer.install(['Font']);
    layer.applyPalette(PALETTES.light);
    layer.show(true);
    expect(fake.layers.has(LAYERS.buildings)).toBe(false);
  });
});
