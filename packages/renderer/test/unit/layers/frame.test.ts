import { toTimestamp } from '@railtime/core/date.utils';
import { engineOf } from '@railtime/network/engine.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { PlanId } from '@railtime/schema/network.types';
import { planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test, vi } from 'vitest';
import { FrameRenderer } from '../../../src/layers/frame.service';
import { SOURCES } from '../../../src/layers/ids.constants';
import { ActiveStepLayer, NetworkLayer } from '../../../src/layers/network.service';
import type { FeatureCollection, LineFeature, NetworkSnapshot } from '../../../src/layers/snapshot.types';
import { StationLayer } from '../../../src/layers/stations.service';
import { TRAIN_UPDATE_MS } from '../../../src/layers/trains.constants';
import { TrainLayer } from '../../../src/layers/trains.service';
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
  const trains = new TrainLayer(fake.map);
  for (const layer of [network, activeStep, trains, stations]) layer.install(['Font']);
  const trainsOn = { shown: false };
  const minimap = { networks: [] as Pick<NetworkSnapshot, 'lines' | 'planned'>[], active: [] as FeatureCollection<LineFeature>[], flushes: [] as number[] };
  const frames = new FrameRenderer({
    ...playback,
    network,
    activeStep,
    stations,
    trains,
    trainService: cursor => engineOf(playback.facts).trainService(cursor),
    showTrains: () => trainsOn.shown,
    minimap: {
      setNetwork: snapshot => {
        minimap.networks.push(snapshot);
      },
      setActive: lines => {
        minimap.active.push(lines);
      },
      flush: now => {
        minimap.flushes.push(now);
      },
    },
    baseColor: line => playback.index.lineOf(line).color,
  });
  return { frames, fake, playback, minimap, trainsOn };
};

/** How many times each source was sent data, by source. */
const sendsOf = (fake: ReturnType<typeof fakeMap>) => Object.fromEntries(fake.sends);

/**
 * Starts the first step of a kind and runs it into its drawing, a frame drawn on the way.
 *
 * @param kind - The kind of step.
 * @param date - The date shown before it.
 * @returns The frames and what they draw on, the step, and the frame time reached.
 */
const drawingStepOf = (kind: 'identity' | 'open', date: string) => {
  const drawn = framesOn(date);
  const { frames, playback } = drawn;
  const step = playback.timeline.steps.find(candidate => candidate.kind === kind)!;
  playback.player.seek(playback.facts.playheads.before(step.index));
  frames.draw(0, null);
  playback.player.play();
  playback.player.skip();
  frames.stepStarted();
  for (let tick = 0; tick < 200 && playback.player.progress < 0.3; tick++) playback.player.tick(1 / 60);
  frames.draw(16, null);
  return { ...drawn, step, now: 16 };
};

describe('FrameRenderer', () => {
  test('sends no trains until turned on, moves them at most so often, and clears them once turned off', () => {
    const { frames, fake, trainsOn } = framesOn('1935-01-01');
    frames.draw(0, null);
    expect(fake.sends.get(SOURCES.trains)).toBeUndefined();

    trainsOn.shown = true;
    frames.draw(1000, null);
    expect(fake.featuresIn(SOURCES.trains).length).toBeGreaterThan(0);
    const sent = fake.sends.get(SOURCES.trains);
    frames.draw(1000 + TRAIN_UPDATE_MS - 1, null);
    expect(fake.sends.get(SOURCES.trains)).toBe(sent);
    frames.draw(1000 + TRAIN_UPDATE_MS, null);
    expect(fake.sends.get(SOURCES.trains)).toBe((sent ?? 0) + 1);

    trainsOn.shown = false;
    frames.draw(2000, null);
    expect(fake.featuresIn(SOURCES.trains)).toEqual([]);
    const cleared = fake.sends.get(SOURCES.trains);
    frames.draw(3000, null);
    expect(fake.sends.get(SOURCES.trains)).toBe(cleared);
  });

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
    expect(minimap.active.some(drawing => drawing.features.length > 0)).toBe(true);
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
    expect(frames.timeState()).toMatchObject({ time: toTimestamp('1935-01-01'), stats: { stations: 4, lines: 2 }, playing: false, inPlan: false });
    expect(frames.timeState()).toBeNull();
    frames.draw(0, null);
    expect(frames.timeState()).toBeNull();
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1935-01-02')));
    expect(frames.timeState()?.time).toBe(toTimestamp('1935-01-02'));
    expect(frames.timeState()).toBeNull();
  });

  test('tells the time to the hundredth of a change: less than that moves tell nothing', () => {
    const { frames, playback } = framesOn('1905-01-01');
    const { player, facts } = playback;
    player.seek(facts.playheads.after(1, 0.251));
    expect(frames.timeState()?.progress).toBeCloseTo(0.251);
    player.seek(facts.playheads.after(1, 0.252));
    expect(frames.timeState()).toBeNull();
    player.seek(facts.playheads.after(1, 0.26));
    expect(frames.timeState()?.progress).toBeCloseTo(0.26);
  });

  test('counts a change as it draws it, not once it is done', () => {
    const { frames, playback } = framesOn('1905-01-01');
    frames.draw(0, null);
    const before = frames.timeState()?.stats;
    const after = playback.facts.asOf(playback.facts.playheads.after(playback.player.cursor + 1)).stats();
    playback.player.play();
    playback.player.skip();
    frames.stepStarted();
    for (let tick = 0; tick < 2000 && playback.player.progress < 0.5; tick++) playback.player.tick(1 / 60);
    frames.draw(16, null);
    const drawing = frames.timeState()?.stats;
    expect(drawing?.km).toBeGreaterThan(before?.km ?? 0);
    expect(drawing?.km).toBeLessThan(after.km);
    expect(drawing?.stations).toBe(after.stations);
  });

  test("counts from the network's own size at both ends, never from what the frame has drawn", () => {
    const { frames, playback } = drawingStepOf('identity', '1989-06-01');
    expect(frames.timeState()?.stats).toEqual(playback.facts.asOf(playback.player.playhead).stats());
  });

  test('keeps a closing stretch solid while the camera gets there, and takes it from the network only as it starts retracting', () => {
    const { frames, fake, playback } = framesOn('1905-01-01');
    const { player } = playback;
    const closure = playback.timeline.steps.find(step => step.kind === 'close')!;
    const closing = new Set(closure.lineSegments.map(lineSegment => lineSegment.line));
    const trackIn = (source: string) =>
      fake
        .featuresIn<LineFeature>(source)
        .filter(feature => feature.properties.line !== '' && closing.has(feature.properties.line))
        .map(feature => feature.geometry.coordinates);
    const track = closure.lineSegments.map(lineSegment => lineSegment.segment.coordinates);
    player.seek(playback.facts.playheads.before(closure.index));
    frames.draw(0, null);
    player.play();
    player.skip();
    frames.stepStarted();
    frames.draw(16, null);
    expect(player.phase).toBe('pre');
    expect(trackIn(SOURCES.lines)).toEqual(expect.arrayContaining(track));
    expect(trackIn(SOURCES.ghosts)).not.toEqual(expect.arrayContaining(track));
    for (let tick = 0; tick < 200 && player.phase === 'pre'; tick++) player.tick(1 / 60);
    frames.draw(32, null);
    expect(player.phase).toBe('draw');
    expect(trackIn(SOURCES.ghosts)).toEqual(expect.arrayContaining(track));
    expect(trackIn(SOURCES.lines)).not.toEqual(expect.arrayContaining(track));
  });

  test('builds the map again only as a step asks something new of it: a rename, a station, asks nothing', () => {
    const { frames, fake, playback } = framesOn('1924-01-01');
    frames.draw(0, null);
    const lines = fake.sends.get(SOURCES.lines);
    playback.player.play();
    playback.player.skip();
    frames.stepStarted();
    expect(playback.player.active?.animation.step.kind).toBe('rename');
    for (let tick = 1; tick <= 200; tick++) {
      playback.player.tick(1 / 60);
      frames.draw(tick * 16, null);
    }
    expect(playback.player.active).not.toBeNull();
    expect(fake.sends.get(SOURCES.lines)).toBe(lines);
  });

  test('paused as lines blend, sends the map and the minimap nothing and tells no time: the blend stands still', () => {
    const { frames, fake, playback, minimap, now } = drawingStepOf('identity', '1989-06-01');
    playback.player.pause();
    frames.draw(now + 16, null);
    frames.timeState();
    const sent = sendsOf(fake);
    const networks = minimap.networks.length;
    const times: unknown[] = [];
    for (let frame = 2; frame <= 30; frame++) {
      frames.draw(now + frame * 16, null);
      times.push(frames.timeState());
    }
    expect(sendsOf(fake)).toEqual(sent);
    expect(minimap.networks).toHaveLength(networks);
    expect(times).toEqual(times.map(() => null));
  });

  test('holding lines blended whole sends the map nothing more', () => {
    const { frames, fake, playback, now } = drawingStepOf('identity', '1989-06-01');
    for (let tick = 0; tick < 500 && playback.player.phase !== 'hold'; tick++) playback.player.tick(1 / 60);
    frames.draw(now + 16, null);
    const lines = fake.sends.get(SOURCES.lines);
    for (let frame = 2; frame <= 10; frame++) {
      playback.player.tick(1 / 60);
      frames.draw(now + frame * 16, null);
    }
    expect(playback.player.phase).toBe('hold');
    expect(fake.sends.get(SOURCES.lines)).toBe(lines);
  });

  test('paused in a change, leaves it drawn as it stands and works nothing out for it', () => {
    const { frames, playback, now } = drawingStepOf('open', '1905-01-01');
    playback.player.pause();
    const drawn = vi.spyOn(playback.player.active!.animation, 'draw');
    for (let frame = 1; frame <= 10; frame++) frames.draw(now + frame * 16, null);
    expect(drawn).not.toHaveBeenCalled();
    expect(frames.growing()).not.toBeNull();
  });

  test("gives the minimap its turn on every frame, by the frame's own clock", () => {
    const { frames, minimap } = framesOn('1935-01-01');
    frames.draw(100, null);
    frames.draw(116, null);
    expect(minimap.flushes).toEqual([100, 116]);
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
    expect(frames.renderState().base.blend).not.toBeNull();
    const before = fake.sends.get(SOURCES.lines) ?? 0;
    for (let frame = 1; frame <= 3; frame++) {
      playback.player.tick(1 / 60);
      frames.draw(frame * 16, null);
    }
    expect(fake.sends.get(SOURCES.lines)).toBe(before + 3);
  });
});
