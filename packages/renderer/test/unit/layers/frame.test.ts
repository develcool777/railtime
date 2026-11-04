import { toTimestamp } from '@railtime/core/date.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { PlanId } from '@railtime/schema/network.types';
import { planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { FrameRenderer } from '../../../src/layers/frame.service';
import { SOURCES } from '../../../src/layers/ids.constants';
import { ActiveStepLayer, NetworkLayer } from '../../../src/layers/network.service';
import type { FeatureCollection, LineFeature, NetworkSnapshot } from '../../../src/layers/snapshot.types';
import { StationLayer } from '../../../src/layers/stations.service';
import { fakeMap } from '../../support/factories/fakeMap.utils';
import { playbackOf } from '../../support/playback.utils';

/**
 * The tiny network's frames drawn on a stand-in map, on a date, with a minimap that keeps what it is sent.
 *
 * @param date - The date shown; its plan's end, with a plan.
 * @param plan - One of its plans to build on it.
 * @returns The frames, the map, the playback and what the minimap was sent.
 */
const framesOn = (date: string, plan?: PlanId) => {
  const playback = playbackOf(tinyNetwork(), { ...(plan && { plan }) });
  if (plan) playback.player.seek(playback.facts.playheads.end());
  else playback.player.seek(playback.facts.playheads.on(toTimestamp(date)));
  const fake = fakeMap();
  const network = new NetworkLayer(fake.map);
  const activeStep = new ActiveStepLayer(fake.map);
  const stations = new StationLayer(
    fake.map,
    station => playback.index.coordOf(station),
    station => station,
    (first, second) => first.localeCompare(second),
  );
  for (const layer of [network, activeStep, stations]) layer.install(['Font']);
  const minimap = { networks: [] as Pick<NetworkSnapshot, 'lines' | 'planned'>[], active: [] as FeatureCollection<LineFeature>[] };
  const frames = new FrameRenderer({
    ...playback,
    playheads: playback.facts.engine.playheads,
    network,
    activeStep,
    stations,
    minimap: {
      setNetwork: snapshot => {
        minimap.networks.push(snapshot);
      },
      setActive: lines => {
        minimap.active.push(lines);
      },
    },
    baseColor: line => playback.index.lineOf(line).color,
  });
  return { frames, fake, playback, minimap };
};

/** How many times each source was sent data, by source. */
const sendsOf = (fake: ReturnType<typeof fakeMap>) => Object.fromEntries(fake.sends);

describe('FrameRenderer', () => {
  test('draws the network and its stations once, then sends the map nothing while nothing changes', () => {
    const { frames, fake, minimap } = framesOn('1935-01-01');
    frames.draw(0, null);
    expect(fake.sends.get(SOURCES.lines)).toBe(1);
    expect(fake.sends.get(SOURCES.stations)).toBe(1);
    expect(minimap.networks).toHaveLength(1);
    const after = sendsOf(fake);
    for (let frame = 1; frame <= 60; frame++) frames.draw(frame * 16, null);
    expect(sendsOf(fake)).toEqual(after);
    expect(fake.sends.get(SOURCES.active)).toBeUndefined();
  });

  test("shows the minimap a plan's track as the map does, dashed apart from the built lines", () => {
    const { frames, fake, minimap } = framesOn('', planId('extension'));
    frames.draw(0, null);
    const planned = fake.data.get(SOURCES.planned) as FeatureCollection<LineFeature>;
    expect(planned.features).not.toEqual([]);
    expect(minimap.networks.at(-1)?.planned).toEqual(planned);
  });

  test('plays a step frame by frame, counting its new stations, and clears it from the map and the minimap once it ends', () => {
    const { frames, fake, playback, minimap } = framesOn('1905-01-01');
    frames.draw(0, null);
    playback.player.play();
    playback.player.skip();
    frames.stepStarted();
    const revealed: number[] = [];
    let now = 0;
    for (let tick = 0; tick < 2000 && playback.player.active; tick++) {
      now += 16;
      playback.player.tick(1 / 60);
      const outcome = frames.draw(now, null);
      if (outcome.revealed !== null) revealed.push(outcome.revealed);
    }
    // Red reaches D (C is not yet a stop on it); then the step ends and the count goes back.
    expect(revealed).toEqual([1, 0]);
    // The growing piece each frame; the track drawn whole only as each segment is done (B – C, C – D), and cleared.
    expect(fake.sends.get(SOURCES.growing)).toBeGreaterThan(10);
    expect(fake.sends.get(SOURCES.active)).toBe(3);
    expect(minimap.active.at(-1)?.features).toEqual([]);
    expect(minimap.active.slice(0, -1).every(drawing => drawing.features.length > 0)).toBe(true);
    // Settled: the pulses run out, then nothing more is sent.
    for (let tick = 1; tick <= 200; tick++) frames.draw(now + tick * 16, null);
    const settled = sendsOf(fake);
    frames.draw(now + 201 * 16, null);
    expect(sendsOf(fake)).toEqual(settled);
  });

  test('says when the selected station is not on the map on the date', () => {
    const { frames } = framesOn('1905-01-01');
    expect(frames.draw(0, stationId('a')).selectionGone).toBe(false);
    expect(frames.draw(16, stationId('d')).selectionGone).toBe(true);
    expect(frames.draw(32, null).selectionGone).toBe(false);
  });

  test('gives the time state when the day, the cursor or the network changed, and nothing in between', () => {
    const { frames, playback } = framesOn('1935-01-01');
    expect(frames.timeState()).toMatchObject({ time: toTimestamp('1935-01-01'), stats: { stations: 0 } });
    expect(frames.timeState()).toBeNull();
    frames.draw(0, null);
    expect(frames.timeState()).toMatchObject({ stats: { stations: 4, lines: 2 }, playing: false, inPlan: false });
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-02')));
    expect(frames.timeState()?.time).toBe(toTimestamp('1935-01-02'));
    expect(frames.timeState()).toBeNull();
  });

  test("blends a line's colour on every frame while its identity changes", () => {
    const { frames, fake, playback } = framesOn('1989-06-01');
    const identity = playback.timeline.steps.find(step => step.kind === 'identity')!;
    playback.player.seek(playback.facts.playheads.before(identity.index));
    frames.draw(0, null);
    playback.player.play();
    playback.player.tick(1 / 60);
    frames.stepStarted();
    // Past the camera's move, into the drawing.
    for (let tick = 0; tick < 90; tick++) playback.player.tick(1 / 60);
    expect(frames.renderState().identityProgress).not.toBeNull();
    const before = fake.sends.get(SOURCES.lines) ?? 0;
    for (let frame = 1; frame <= 3; frame++) {
      playback.player.tick(1 / 60);
      frames.draw(frame * 16, null);
    }
    expect(fake.sends.get(SOURCES.lines)).toBe(before + 3);
  });
});
