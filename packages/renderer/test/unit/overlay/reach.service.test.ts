import { toTimestamp } from '@railtime/core/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import type { ReachTrackFeature } from '../../../src/layers/snapshot.types';
import { pointFeature } from '../../../src/layers/snapshot.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { reachStops, reachTrack } from '../../../src/overlay/overlay.utils';
import { ReachLayer } from '../../../src/overlay/reach.service';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { networkNow, playbackOf } from '../../support/playback.utils';

/** How far one gets from A in 1955, when red runs A–B–C–D, and the network it is found on. */
const reachFromA = () => {
  const playback = playbackOf(tinyNetwork());
  playback.player.seek(playback.facts.playheads.on(toTimestamp('1955-01-01')));
  return { playback, reach: networkNow(playback).reach(stationId('a'))! };
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

  test('draws a reach found on a network: features the map can draw, with what its layers read', () => {
    const fake = fakeMap();
    const layer = new ReachLayer(fake.map);
    layer.install(['Font']);
    const { playback, reach } = reachFromA();
    const track = reachTrack(playback.index, reach);
    layer.update(track, reachStops(playback.index, reach));
    // The stand-in map checked what it was sent.
    expect(fake.sends.get(SOURCES.reachTrack)).toBe(1);
  });
});
