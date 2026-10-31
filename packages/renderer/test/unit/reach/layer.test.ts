import { describe, expect, test } from 'vitest';
import type { ReachTrackFeature } from '../../../src/layers/features.types';
import { pointFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { ReachLayer } from '../../../src/reach/layer.service';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { REACH_BANDS } from '../../../src/reach/layer.constants';
import { bandOf, reachStops, reachTrack, reachedSegments } from '../../../src/reach/layer.utils';
import { toTimestamp } from '../../../src/core/date.utils';
import { NetworkQueries } from '../../../src/network/queries.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

describe('ReachLayer', () => {
  test('draws the track and stations reached, the start named apart, and clears them', () => {
    const fake = fakeMap();
    const layer = new ReachLayer(fake.map);
    layer.install(['Font']);
    layer.applyPalette(PALETTES.light);
    expect(fake.layers.get(LAYERS.reachStops)?.paint['circle-stroke-color']).toBe(PALETTES.light.labelHalo);
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
});

describe('ReachLayerUtils', () => {
  describe('bandOf', () => {
    test('puts a time in the first band it fits, its end included', () => {
      expect(bandOf(0)).toBe(0);
      expect(bandOf(15)).toBe(0);
      expect(bandOf(15.5)).toBe(1);
      expect(bandOf(59)).toBe(3);
    });

    test('puts anything longer in the last band', () => {
      expect(bandOf(240)).toBe(REACH_BANDS.length - 1);
    });
  });

  describe('reachedSegments', () => {
    const segments = [
      { index: 0, stationA: 'a', stationB: 'b' },
      { index: 1, stationA: 'b', stationB: 'c' },
      { index: 2, stationA: 'x', stationB: 'y' },
    ];

    test('times a segment by the mean of its ends, or its one end reached', () => {
      const minutes = new Map([
        ['a', 0],
        ['b', 10],
      ]);
      expect(reachedSegments(minutes, segments)).toEqual([
        { segment: 0, minutes: 5 },
        { segment: 1, minutes: 10 },
      ]);
    });

    test('leaves out a segment with neither end reached', () => {
      expect(reachedSegments(new Map(), segments)).toEqual([]);
    });
  });

  /** How far one gets from A in 1955, when red runs A–B–C–D, and the network it is found on. */
  const reachFromA = () => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(toTimestamp('1955-01-01'));
    const queries = new NetworkQueries(playback.index, playback.timeline, playback.player.today);
    const moment = { cursor: playback.player.cursor, clock: playback.player.clock, colorOf: () => '#f00' };
    return { playback, reach: queries.reach('a', moment)! };
  };

  describe('reachTrack', () => {
    test("colours each open segment reached in its time's band, and nothing without a reach", () => {
      const { playback, reach } = reachFromA();
      const track = reachTrack(playback.index, playback.timeline, playback.player.cursor, reach);
      expect(track.map(feature => feature.geometry.coordinates)).toEqual([0, 1, 2].map(segment => playback.index.segments[segment]!.coordinates));
      expect(new Set(track.map(feature => feature.properties.color))).toEqual(new Set([REACH_BANDS[0]!.color]));
      expect(reachTrack(playback.index, playback.timeline, playback.player.cursor, null)).toEqual([]);
    });
  });

  describe('reachStops', () => {
    test('names the start apart and every other station with its time, and nothing without a reach', () => {
      const { playback, reach } = reachFromA();
      const stops = reachStops(playback.index, reach);
      expect(stops[0]?.properties).toEqual({ color: REACH_BANDS[0]!.color, label: 'A', minutes: 0, origin: true });
      expect(stops.slice(1).map(stop => stop.properties.label)).toEqual(reach.stations.map(station => `${station.name} · ${Math.round(station.minutes)} min`));
      expect(stops.every(stop => !stop.properties.origin || stop === stops[0])).toBe(true);
      expect(reachStops(playback.index, null)).toEqual([]);
    });
  });
});
