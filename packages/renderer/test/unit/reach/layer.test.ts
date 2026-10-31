import { describe, expect, test } from 'vitest';
import type { ReachTrackFeature } from '../../../src/layers/features.types';
import { pointFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { ReachLayer } from '../../../src/reach/layer.service';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { reachStops, reachTrack } from '../../../src/reach/layer.utils';
import { toTimestamp } from '@railtime/network/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { networkNow, playbackOf } from '../../support/playback.utils';

/** How far one gets from A in 1955, when red runs A–B–C–D, and the network it is found on. */
const reachFromA = () => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek({ time: toTimestamp('1955-01-01') });
  return { playback, reach: networkNow(playback).reach('a')! };
};

describe('ReachLayer', () => {
  test('draws the track and stations reached, the start named apart, and clears them', () => {
    const fake = fakeMap();
    const layer = new ReachLayer(fake.map);
    layer.install(['Font']);
    layer.applyPalette(PALETTES.light);
    expect(fake.layers.get(LAYERS.reachStops)?.paint['circle-stroke-color']).toBe(PALETTES.light.labelHalo);
    for (const labels of [LAYERS.reachLabels, LAYERS.reachOriginLabel]) expect(fake.layers.get(labels)?.paint['text-color']).toBe(PALETTES.light.label);
    expect(fake.layers.get(LAYERS.reachOriginLabel)?.filter).toEqual(['get', 'origin']);

    const track: ReachTrackFeature = {
      type: 'Feature',
      properties: { color: '#0a0' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 0],
        ],
      },
    };
    const start = pointFeature([0, 0], { color: '#0a0', label: 'A', minutes: 0, origin: true });
    layer.update([track], [start]);
    expect(fake.data.get(SOURCES.reachTrack)).toEqual({ type: 'FeatureCollection', features: [track] });
    expect(fake.data.get(SOURCES.reachStops)).toEqual({ type: 'FeatureCollection', features: [start] });
    layer.update([], []);
    expect(fake.data.get(SOURCES.reachStops)).toEqual({ type: 'FeatureCollection', features: [] });
  });

  test('draws a reach given before the basemap loaded once installed, and says whether one is shown', () => {
    const fake = fakeMap();
    const layer = new ReachLayer(fake.map);
    const start = pointFeature([0, 0], { color: '#0a0', label: 'A', minutes: 0, origin: true });
    expect(layer.shown).toBe(false);
    layer.update([], [start]);
    expect(layer.shown).toBe(true);
    layer.install(['Font']);
    expect(fake.data.get(SOURCES.reachStops)).toEqual({ type: 'FeatureCollection', features: [start] });
    layer.update([], []);
    expect(layer.shown).toBe(false);
  });

  test('draws a reach found on a network: features the map can draw, with what its layers read', () => {
    const fake = fakeMap();
    const layer = new ReachLayer(fake.map);
    layer.install(['Font']);
    const { playback, reach } = reachFromA();
    const track = reachTrack(playback.index, reach);
    layer.update(track, reachStops(playback.index, reach));
    // Once, empty, as it was installed; once with the reach, which the stand-in map checked.
    expect(fake.sends.get(SOURCES.reachTrack)).toBe(2);
  });
});

describe('ReachLayerUtils', () => {
  describe('reachTrack', () => {
    test("draws each segment the reach colours along its track, in its band's colour, and nothing without a reach", () => {
      const { playback, reach } = reachFromA();
      const track = reachTrack(playback.index, reach);
      expect(track.map(feature => feature.geometry.coordinates)).toEqual(reach.track.map(({ segment }) => playback.index.segments[segment]!.coordinates));
      expect(track.map(feature => feature.properties.color)).toEqual(reach.track.map(({ band }) => reach.bands[band]!.color));
      expect(reachTrack(playback.index, null)).toEqual([]);
    });
  });

  describe('reachStops', () => {
    test('names the start apart and every other station with its time, and nothing without a reach', () => {
      const { playback, reach } = reachFromA();
      const stops = reachStops(playback.index, reach);
      expect(stops[0]?.properties).toEqual({ color: reach.bands[0]!.color, label: 'A', minutes: 0, origin: true });
      expect(stops.slice(1).map(stop => stop.properties.label)).toEqual(reach.stations.map(station => `${station.name} · ${Math.round(station.minutes)} min`));
      expect(stops.every(stop => !stop.properties.origin || stop === stops[0])).toBe(true);
      expect(reachStops(playback.index, null)).toEqual([]);
    });
  });
});
