import { engineOf } from '@railtime/network/engine.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { lineId } from '@railtime/schema/testing/ids';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { BASEMAP_BUILDINGS } from '../../../src/layers/buildings.constants';
import { LAYERS } from '../../../src/layers/ids.constants';
import { MapLayers } from '../../../src/layers/stack.service';
import { atZoom } from '../../../src/layers/style.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { TRAIN_STYLE } from '../../../src/layers/trains.constants';
import { SEGMENT_CORNERS, STROKE_VERTEX_FLOATS } from '../../../src/motion/motion.constants';
import type { Mover } from '../../../src/motion/motion.types';
import { rgbOf } from '../../../src/motion/motion.utils';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';
import { playbackOf } from '../../support/playback.utils';

/** A basemap with land and buildings, as the default one has. */
const BASEMAP: LayerSpecification[] = [
  LAND_LAYER,
  { id: 'building', type: 'fill', source: BASEMAP_BUILDINGS.source, 'source-layer': BASEMAP_BUILDINGS.sourceLayer, paint: {} },
];

/** A train of one segment on the red line. */
const TRAIN: Mover = {
  path: [
    [0, 51.5],
    [0.001, 51.5],
  ],
  color: '#ff0000',
  slot: 0,
  group: 'red',
};

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
      LAYERS.motion,
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
    layers.motion.show('trains', [TRAIN]);
    fake.paint();
    expect((fake.webgl.draws.at(-1)?.uniforms.u_colors as number[]).slice(-3)).toEqual(rgbOf(PALETTES.light.trainBody));
  });

  test('stands the buildings and the trains up and lays them down', () => {
    const { fake, layers } = installed();
    layers.applyTheme(PALETTES.dark, true);
    layers.motion.show('trains', [TRAIN]);
    /**
     * The buildings' visibility, and how high the trains' roofs are drawn next.
     *
     * @returns Both.
     */
    const stood = () => {
      fake.webgl.draws.length = 0;
      fake.paint();
      return [fake.layers.get(LAYERS.buildings)?.layout.visibility, (fake.webgl.draws.at(-1)?.uniforms.u_rises as number[]).at(-1)];
    };
    layers.stand(true);
    expect(stood()).toEqual(['visible', atZoom(TRAIN_STYLE.risePx, fake.view.zoom)]);
    layers.stand(false);
    expect(stood()).toEqual(['none', 0]);
  });

  test('fades the network and its stations behind what is over it, whatever the lines in focus; else brings those forward', () => {
    const { fake, layers } = installed();
    layers.applyTheme(PALETTES.dark, true);
    layers.motion.show('trains', [TRAIN, { ...TRAIN, group: 'blue' }]);
    /**
     * How many trains the map draws next.
     *
     * @returns How many.
     */
    const trainsDrawn = () => {
      fake.webgl.uploads.length = 0;
      fake.paint();
      return (fake.webgl.uploads[0] ?? 0) / (SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS);
    };
    layers.applyBackdrop(true, [lineId('red')]);
    expect(trainsDrawn()).toBe(0);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 0, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
    layers.applyBackdrop(false, [lineId('red')]);
    expect(trainsDrawn()).toBe(1);
    expect(fake.layers.get(LAYERS.labels)?.paint['text-opacity']).toEqual(['*', 1, ['coalesce', ['feature-state', 'labelOpacity'], 1]]);
    layers.applyBackdrop(false, null);
    expect(trainsDrawn()).toBe(2);
  });
});
