import { engineOf } from '@railtime/network/engine.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { lineId } from '@railtime/schema/testing/ids';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { BASEMAP_BUILDINGS } from '../../../src/layers/buildings.constants';
import { LAYERS } from '../../../src/layers/ids.constants';
import { MapLayers } from '../../../src/layers/stack.service';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';
import { playbackOf } from '../../support/playback.utils';

/** A basemap with land and buildings, as the default one has. */
const BASEMAP: LayerSpecification[] = [
  LAND_LAYER,
  { id: 'building', type: 'fill', source: BASEMAP_BUILDINGS.source, 'source-layer': BASEMAP_BUILDINGS.sourceLayer, paint: {} },
];

/**
 * The layer groups on a stand-in map, installed.
 *
 * @returns The groups and the stand-in.
 */
const installed = () => {
  const fake = fakeMap(BASEMAP);
  const { facts, player } = playbackOf(tinyNetwork());
  const layers = new MapLayers(
    fake.map,
    () => engineOf(facts),
    () => player.clock,
  );
  layers.install();
  return { fake, layers };
};

describe('MapLayers', () => {
  test('installs its groups bottom to top: coverage under the buildings, the network, the step, the trains, the stations, a route and a reach', () => {
    const order = [...installed().fake.layers.keys()];
    const places = [
      LAYERS.coverageHeat,
      LAYERS.buildings,
      LAYERS.lines,
      LAYERS.activeLines,
      LAYERS.trains,
      LAYERS.stations,
      LAYERS.routeLine,
      LAYERS.reachTrack,
    ].map(layer => order.indexOf(layer));
    expect(places).toEqual(places.toSorted((first, second) => first - second));
    expect(places).not.toContain(-1);
  });

  test('colours the basemap and every group for a theme', () => {
    const { fake, layers } = installed();
    layers.applyTheme(PALETTES.light, true);
    expect(fake.layers.get(LAND_LAYER.id)?.paint['background-color']).toBe(PALETTES.light.background);
    expect(fake.layers.get(LAYERS.buildings)?.paint['fill-extrusion-color']).toBe(PALETTES.light.landuse);
    expect(fake.layers.get(LAYERS.trains)?.paint['line-color']).toBe(PALETTES.light.trainBody);
  });

  test('stands the buildings up and lays them down', () => {
    const { fake, layers } = installed();
    layers.showBuildings(true);
    expect(fake.layers.get(LAYERS.buildings)?.layout.visibility).toBe('visible');
    layers.showBuildings(false);
    expect(fake.layers.get(LAYERS.buildings)?.layout.visibility).toBe('none');
  });

  test('fades the network and its stations behind what is over it, whatever the lines in focus; else brings those forward', () => {
    const { fake, layers } = installed();
    layers.applyTheme(PALETTES.dark, true);
    layers.applyBackdrop(true, [lineId('red')]);
    expect(fake.layers.get(LAYERS.trains)?.filter).toEqual(['in', ['get', 'line'], ['literal', []]]);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 0, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
    layers.applyBackdrop(false, [lineId('red')]);
    expect(fake.layers.get(LAYERS.trains)?.filter).toEqual(['in', ['get', 'line'], ['literal', ['red']]]);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 1, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
    layers.applyBackdrop(false, null);
    expect(fake.layers.get(LAYERS.trains)?.filter).toEqual(['all']);
  });
});
