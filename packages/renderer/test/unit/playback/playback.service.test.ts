import { toTimestamp } from '@railtime/core/date.utils';
import { engineOf } from '@railtime/network/engine.utils';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, test } from 'vitest';
import { BASEMAP_BUILDINGS } from '../../../src/layers/buildings.constants';
import { MapLayers } from '../../../src/layers/stack.service';
import { CameraDirector } from '../../../src/playback/camera.service';
import { Playback } from '../../../src/playback/playback.service';
import { DEFAULT_MAP_PROPS } from '../../../src/transitMap.constants';
import type { MapProps } from '../../../src/transitMap.types';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { LAND_LAYER } from '../../support/fakeMap.constants';

/** Today, for every playback here. */
const TODAY = toTimestamp('2026-01-01');

/** A basemap with land and buildings under the network, as the map's style has. */
const BASEMAP: LayerSpecification[] = [
  LAND_LAYER,
  { id: 'building', type: 'fill', source: BASEMAP_BUILDINGS.source, 'source-layer': BASEMAP_BUILDINGS.sourceLayer, paint: {} },
];

/**
 * A playback of the tiny network wired as `TransitMap` wires it, on a stand-in map, its layers
 * installed, and what it tells the app.
 *
 * @returns The playback, its props and what it told.
 */
const playbackOn = () => {
  const fake = fakeMap(BASEMAP);
  const props: MapProps = { facts: NetworkFacts.create(tinyNetwork(), { today: TODAY }), ...DEFAULT_MAP_PROPS };
  const layers = new MapLayers(
    fake.map,
    () => engineOf(props.facts),
    () => 0,
  );
  layers.install();
  const told: string[] = [];
  const playback = new Playback({
    props: () => props,
    camera: new CameraDirector(fake.map, () => props),
    layers,
    minimap: null,
    tilesLoaded: () => true,
    notify: event => {
      told.push(event);
    },
  });
  return { playback, props, told };
};

describe('Playback', () => {
  test('opens on the facts it is given, paused at today', () => {
    const { playback, props } = playbackOn();
    expect(playback.facts).toBe(props.facts);
    expect(playback.player.playing).toBe(false);
    expect(playback.player.playhead).toEqual(props.facts.playheads.today());
  });

  test('plays from a playhead, and pauses where it is', () => {
    const { playback, props } = playbackOn();
    playback.play(props.facts.playheads.on(toTimestamp('1950-01-01')));
    expect(playback.player.playing).toBe(true);
    playback.pause();
    expect(playback.player.playing).toBe(false);
    expect(playback.player.playhead).toEqual(props.facts.playheads.on(toTimestamp('1950-01-01')));
  });

  test('moves to a playhead, paused still, and a year back from it', () => {
    const { playback, props } = playbackOn();
    playback.seek(props.facts.playheads.on(toTimestamp('1950-01-01')));
    expect(playback.player.playing).toBe(false);
    expect(playback.player.playhead).toEqual(props.facts.playheads.on(toTimestamp('1950-01-01')));
    playback.stepYear(-1);
    expect(playback.player.clock).toBeLessThan(toTimestamp('1950-01-01'));
  });

  test('tells the app the time once a frame draws, and draws nothing before the map is ready', () => {
    const { playback, told } = playbackOn();
    told.length = 0;
    playback.frame(0, 0, false);
    expect(told).not.toContain('time');
    playback.frame(16, 0.016, true);
    expect(told).toContain('time');
  });
});
