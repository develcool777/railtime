import { describe, expect, test } from 'vitest';
import type { RouteFeature } from '../../../src/layers/snapshot.types';
import { pointFeature } from '../../../src/layers/snapshot.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { RouteLayer } from '../../../src/overlay/route.service';
import { routeStopMarks, routeStops, routeTrack } from '../../../src/overlay/overlay.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { networkNow, playbackOf } from '../../support/playback.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import type { RouteInfo, RouteLegInfo } from '@railtime/network/facts.types';

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
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-01')));
    return { index: playback.index, route: networkNow(playback).routes('a', 'd')[0]! };
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

/**
 * A ride on a line through stops named by their ids.
 *
 * @param color - The line's colour in the light theme, which is its id too; in the dark, upper case.
 * @param stops - The stops' ids, from where it is boarded.
 * @returns The leg.
 */
const ride = (color: string, stops: string[]): RouteLegInfo => ({
  kind: 'ride',
  line: color,
  lineName: color,
  color: { light: color, dark: color.toUpperCase() },
  stops: stops.map(id => ({ id, name: id.toUpperCase() })),
  minutes: 0,
  km: 0,
});

/**
 * A route made of legs, from the first stop of the first to the given end.
 *
 * @param legs - Its legs.
 * @param to - Where it ends.
 * @returns The route.
 */
const routeOf = (legs: RouteLegInfo[], to: string): RouteInfo => ({
  from: { id: 'a', name: 'A' },
  to: { id: to, name: to.toUpperCase() },
  legs,
  minutes: 0,
  km: 0,
  changes: legs.length - 1,
  segments: [],
  best: [],
});

describe('RouteStopsUtils', () => {
  describe('routeStopMarks', () => {
    test('rings where each ride begins, passes the stops between, ends at the last', () => {
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'b', 'c']), ride('blue', ['c', 'd', 'e'])], 'e'), 'light');
      expect(marks.map(entry => [entry.station, entry.kind, entry.color])).toEqual([
        ['a', 'board', 'red'],
        ['b', 'pass', 'red'],
        ['c', 'board', 'blue'],
        ['d', 'pass', 'blue'],
        ['e', 'end', 'blue'],
      ]);
    });

    test("colours each mark in its line's colour for the theme asked for", () => {
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'b'])], 'b'), 'dark');
      expect(marks.map(entry => entry.color)).toEqual(['RED', 'RED']);
    });

    test('rings both ends of a walk, as changes', () => {
      const walk: RouteLegInfo = { kind: 'walk', from: { id: 'c', name: 'C' }, to: { id: 'x', name: 'X' }, minutes: 3 };
      const marks = routeStopMarks(routeOf([ride('red', ['a', 'c']), walk, ride('blue', ['x', 'e'])], 'e'), 'light');
      expect(marks.map(entry => [entry.station, entry.kind])).toEqual([
        ['a', 'board'],
        ['c', 'board'],
        ['x', 'board'],
        ['e', 'end'],
      ]);
    });
  });
});
