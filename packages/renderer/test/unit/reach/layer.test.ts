import { describe, expect, test } from 'vitest';
import type { ReachTrackFeature } from '../../../src/layers/features.types';
import { pointFeature } from '../../../src/layers/features.utils';
import { LAYERS, SOURCES } from '../../../src/layers/ids.constants';
import { ReachLayer } from '../../../src/reach/layer.service';
import { PALETTES } from '../../../src/layers/theme.constants';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { REACH_BANDS } from '../../../src/reach/layer.constants';
import { bandOf, reachedSegments } from '../../../src/reach/layer.utils';

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
});
