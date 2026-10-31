import { describe, expect, test } from 'vitest';
import type { RouteFeature } from '../../../src/layers/features.types';
import { pointFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { RouteLayer } from '../../../src/route/layer.service';
import { routeStops, routeTrack } from '../../../src/route/layer.utils';
import { toTimestamp } from '@railtime/network/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { networkNow, playbackOf } from '../../support/playback.utils';
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
      properties: { color: '#ff0000', walk: false },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    const stop = pointFeature([0, 0], { kind: 'board' as const, color: '#ff0000', name: 'A' });
    layer.update([ride], [stop]);
    expect(fake.data.get(SOURCES.route)).toEqual({ type: 'FeatureCollection', features: [ride] });
    expect(fake.data.get(SOURCES.routeStops)).toEqual({ type: 'FeatureCollection', features: [stop] });
    layer.update([], []);
    expect(fake.data.get(SOURCES.route)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  test('draws a route given before the basemap loaded once installed, and says whether one is shown', () => {
    const fake = fakeMap();
    const layer = new RouteLayer(fake.map);
    const stop = pointFeature([0, 0], { kind: 'end' as const, color: '#ff0000', name: 'A' });
    const ride: RouteFeature = {
      type: 'Feature',
      properties: { color: '#ff0000', walk: false },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    expect(layer.shown).toBe(false);
    layer.update([ride], [stop]);
    expect(layer.shown).toBe(true);
    layer.install(['Font']);
    expect(fake.data.get(SOURCES.route)).toEqual({ type: 'FeatureCollection', features: [ride] });
    expect(fake.data.get(SOURCES.routeStops)).toEqual({ type: 'FeatureCollection', features: [stop] });
    layer.update([], []);
    expect(layer.shown).toBe(false);
  });
});

describe('RouteLayerUtils', () => {
  /** A route from A to D in 1935, along red, and the network it runs on. */
  const routeAtoD = () => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek({ time: toTimestamp('1935-01-01') });
    return { index: playback.index, route: networkNow(playback).route('a', 'd', 'fastest')! };
  };

  describe('routeTrack', () => {
    test("draws each ride along its segments in its line's colour, a walk straight, and nothing without a route", () => {
      const { index, route } = routeAtoD();
      expect(routeTrack(index, route, 'light').map(feature => [feature.properties, feature.geometry.coordinates])).toEqual(
        [0, 1, 2].map(segment => [{ color: '#ff0000', walk: false }, index.segments[segment]!.coordinates]),
      );
      const walk = { ...route, legs: [{ kind: 'walk' as const, from: route.from, to: route.to, minutes: 5 }], segments: [[]] };
      expect(routeTrack(index, walk, 'light')).toEqual([
        { type: 'Feature', properties: { color: '', walk: true }, geometry: { type: 'LineString', coordinates: [index.coordOf('a'), index.coordOf('d')] } },
      ]);
      expect(routeTrack(index, null, 'light')).toEqual([]);
    });
  });

  describe('routeStops', () => {
    test('marks each stop where it is, and none without a route', () => {
      const { index, route } = routeAtoD();
      const stops = routeStops(index, route, 'light');
      expect(stops.map(stop => [stop.properties.name, stop.properties.kind])).toEqual([
        ['A', 'board'],
        ['B', 'pass'],
        ['C', 'pass'],
        ['D', 'end'],
      ]);
      expect(stops[0]?.geometry.coordinates).toEqual(index.coordOf('a'));
      expect(routeStops(index, null, 'light')).toEqual([]);
    });
  });
});
