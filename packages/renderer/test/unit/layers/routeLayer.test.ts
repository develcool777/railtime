import { describe, expect, test } from 'vitest';
import type { RouteFeature } from '../../../src/layers/features.types';
import { pointFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/layers.constants';
import { RouteLayer } from '../../../src/layers/routeLayer.service';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';

describe('RouteLayer', () => {
  test('draws a route and its stops, coloured for the theme, and clears it', () => {
    const fake = fakeMap();
    const layer = new RouteLayer(fake.map);
    layer.install(['Font']);
    layer.applyPalette(PALETTES.dark);
    expect(fake.layers.get(LAYERS.routeCasing)?.paint['line-color']).toBe(PALETTES.dark.labelHalo);
    expect(fake.layers.get(LAYERS.routeLabels)?.layout['text-font']).toEqual(['Font']);

    const ride: RouteFeature = {
      type: 'Feature',
      properties: { color: '#f00', walk: false },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    const stop = pointFeature([0, 0], { kind: 'board' as const, color: '#f00', name: 'A' });
    layer.update([ride], [stop]);
    expect(fake.data.get(SOURCES.route)).toEqual({ type: 'FeatureCollection', features: [ride] });
    expect(fake.data.get(SOURCES.routeStops)).toEqual({ type: 'FeatureCollection', features: [stop] });
    layer.update([], []);
    expect(fake.data.get(SOURCES.route)).toEqual({ type: 'FeatureCollection', features: [] });
  });
});
