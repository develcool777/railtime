import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { createStepAnimation, emptyDrawing } from '../../../src/steps/animation.utils';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { playbackOf, renderStateOf } from '../../support/playback.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import { GROWTH_PACE, HOLD_BASE_SECONDS, HOLD_PER_STATION_SECONDS } from '../../../src/steps/animation.constants';
import {
  CloseStepAnimation,
  IdentityStepAnimation,
  InfillStepAnimation,
  OpenStepAnimation,
  RenameStepAnimation,
  StationCloseStepAnimation,
} from '../../../src/steps/animation.service';
import { stepAfter } from '../../support/stepFrames.utils';
import type { Network } from '@railtime/schema/network.types';

describe('StepAnimationUtils', () => {
  describe('createStepAnimation', () => {
    test('gives every kind of step an animation that frames and draws it from start to end', () => {
      const playback = playbackOf(tinyNetwork(), 'extension');
      const { index, timeline } = playback;
      const kinds = new Set<string>();
      for (const step of timeline.steps) {
        playback.player.seek({ beforeChange: step.index });
        const animation = createStepAnimation(step, { index, timeline, view: '2d' as const });
        kinds.add(step.kind);
        expect(animation.step).toBe(step);
        expect(animation.drawSeconds).toBeGreaterThan(0);
        expect(animation.holdSeconds).toBeGreaterThan(0);
        expect(animation.cameraPoints().length).toBeGreaterThan(0);
        const state = { ...renderStateOf(playback), identityProgress: animation.changesIdentity ? 0.5 : null };
        const snapshot = buildNetworkSnapshot(state, true);
        for (const [progress, holdProgress] of [
          [0, 0],
          [0.5, 0],
          [1, 0],
          [1, 0.5],
          [1, 1],
        ] as const) {
          const drawing = emptyDrawing();
          animation.draw({ state, snapshot, progress, holdProgress }, drawing);
          // Whatever it draws is in some line's colour, and a closing station never fades beyond nothing.
          for (const feature of drawing.lines.features) expect(feature.properties.color).toMatch(/^#[0-9a-f]{6}$/);
          for (const opacity of drawing.fading.values()) expect(opacity).toBeGreaterThanOrEqual(0);
        }
      }
      expect(kinds).toEqual(new Set(['open', 'close', 'infill', 'stationClose', 'rename', 'identity']));
    });
  });
});

/** Degrees of longitude in a km on the test line, as the tiny network places its stations. */
const ONE_KM = 0.0144;

describe('OpenStepAnimation', () => {
  /** Red's 1910 stretch: from B, already on the map, on to C and D, 1 km each. */
  const extension = () => stepAfter(tinyNetwork(), '1905-01-01');

  test('highlights the stations a stretch opens as the growth front passes them', () => {
    const { animation, draw } = extension();
    expect(animation).toBeInstanceOf(OpenStepAnimation);
    // Half-way the front has passed C, but C is an infill station: it does not open on red until 1920.
    expect([...draw(0.5).highlighted]).toEqual([]);
    expect([...draw(1).highlighted]).toEqual(['d']);
    // D opened in 1910 under its name then, Old D.
  });

  test('grows more slowly in 3D, where the camera follows it at street level', () => {
    const playback = playbackOf(tinyNetwork(), undefined, '3d');
    playback.player.seek({ time: toTimestamp('1905-01-01') });
    playback.player.skip();
    // 2 km at 0.8 km a second.
    expect(playback.player.active?.animation.drawSeconds).toBeCloseTo(2 / GROWTH_PACE['3d'].kmPerSecond, 1);
    expect(GROWTH_PACE['3d'].kmPerSecond).toBeLessThan(GROWTH_PACE['2d'].kmPerSecond);
  });

  test('takes as long as its track, a second at least, and holds a little longer for each new station', () => {
    const { animation } = extension();
    // 2 km at 2.5 km a second is under the shortest.
    expect(animation.drawSeconds).toBe(GROWTH_PACE['2d'].minSeconds);
    expect(animation.holdSeconds).toBeCloseTo(HOLD_BASE_SECONDS + 2 * HOLD_PER_STATION_SECONDS);
  });

  test('grows out of the network along its track, a head at the front, and frames all of it', () => {
    const { animation, draw, playback } = extension();
    const quarter = draw(0.25);
    expect(quarter.lines.features).toHaveLength(1);
    const [growing] = quarter.lines.features;
    expect(growing?.geometry.coordinates[0]).toEqual([ONE_KM, 51.5]);
    // A camera following it starts where it grows from: B.
    expect(animation.startPoint()).toEqual([ONE_KM, 51.5]);
    expect(growing?.geometry.coordinates.at(-1)?.[0]).toBeCloseTo(1.5 * ONE_KM, 6);
    expect(growing?.properties).toMatchObject({ color: '#ff0000', highlight: 1 });
    expect(quarter.heads.features.map(head => head.geometry.coordinates)).toEqual([growing?.geometry.coordinates.at(-1)]);
    expect(quarter.heads.features[0]?.properties).toEqual({ color: '#ff0000' });
    // Fully drawn: both segments, no head; the highlight fades as it holds.
    const drawn = draw(1, { holdProgress: 0.25 });
    expect(drawn.lines.features).toHaveLength(2);
    expect(drawn.heads.features).toEqual([]);
    expect(drawn.lines.features.map(feature => feature.properties.highlight)).toEqual([0.75, 0.75]);
    expect(animation.cameraPoints()).toEqual([...playback.index.segments[1]!.coordinates, ...playback.index.segments[2]!.coordinates]);
  });

  test('draws nothing of a hidden line, and reaches none of its stations', () => {
    const drawing = extension().draw(1, { hidden: ['red'] });
    expect(drawing.lines.features).toEqual([]);
    expect(drawing.heads.features).toEqual([]);
    expect(drawing.reached.size).toBe(0);
    expect(drawing.highlighted.size).toBe(0);
  });
});

/**
 * The tiny network with blue also on a branch from D to a station E of its own, drawn from E, which
 * closes with blue's B – C in 1950: E is left with no line.
 *
 * @returns The network.
 */
const withBranch = (): Network => {
  const network = tinyNetwork();
  network.stations.e = { name: 'E', coordinate: [4 * ONE_KM, 51.5] };
  network.segments.push({
    stationA: 'e',
    stationB: 'd',
    lines: { blue: { open: '1930-01-01', close: '1950-01-01' } },
    coordinates: [
      [4 * ONE_KM, 51.5],
      [3 * ONE_KM, 51.5],
    ],
  });
  return network;
};

describe('CloseStepAnimation', () => {
  test('plays a section suspended, or closing for good, as a close', () => {
    expect(stepAfter(tinyNetwork(), '1939-01-01').animation).toBeInstanceOf(CloseStepAnimation);
    expect(stepAfter(tinyNetwork(), '1949-01-01').animation).toBeInstanceOf(CloseStepAnimation);
  });

  test('retracts each segment towards the end that stays on the map, and fades a station left with no line', () => {
    const { animation, draw, playback } = stepAfter(withBranch(), '1949-01-01');
    const half = draw(0.5);
    const [main, branch] = half.lines.features.map(feature => feature.geometry.coordinates);
    // B – C keeps its B half; the branch keeps its D half, though it is drawn from E.
    expect(main?.[0]).toEqual([ONE_KM, 51.5]);
    expect(main?.at(-1)?.[0]).toBeCloseTo(1.5 * ONE_KM, 6);
    expect(branch?.[0]).toEqual([3 * ONE_KM, 51.5]);
    expect(branch?.at(-1)?.[0]).toBeCloseTo(3.5 * ONE_KM, 6);
    expect(half.lines.features.every(feature => feature.properties.color === '#0000ff')).toBe(true);
    expect(half.fading).toEqual(new Map([['e', 0.5]]));
    // Gone at the end; a hidden line draws nothing, and its station is not on the map to fade.
    expect(draw(1).lines.features).toEqual([]);
    expect(draw(1).fading).toEqual(new Map([['e', 0]]));
    expect(draw(0.5, { hidden: ['blue'] }).lines.features).toEqual([]);
    expect(draw(0.5, { hidden: ['blue'] }).fading.size).toBe(0);
    const branchTrack = playback.index.segments.find(segment => segment.stationA === 'e')!.coordinates;
    expect(animation.cameraPoints()).toEqual([...playback.index.segments[1]!.coordinates, ...branchTrack]);
  });
});

describe('InfillStepAnimation', () => {
  test('puts the station on its line and highlights it while its step plays, not only once it is over', () => {
    // C opens on red, on track red has run over since 1910.
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1915-01-01');
    expect(animation).toBeInstanceOf(InfillStepAnimation);
    const drawing = draw(0.1);
    expect([...drawing.highlighted]).toEqual(['c']);
    expect(drawing.reached.get('c')).toEqual(new Map([['red', '#ff0000']]));
    // A lone station starts and ends where it stands.
    expect(animation.startPoint()).toEqual(animation.cameraPoints()[0]);
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('c')]);
  });

  test('adds nothing for a hidden line the station opens on', () => {
    const network = tinyNetwork();
    network.stations.c!.infill = { red: '1935-01-01', blue: '1935-01-01' };
    const { draw } = stepAfter(network, '1934-01-01');
    const hidden = draw(0.5, { hidden: ['red', 'blue'] });
    expect(hidden.reached.size).toBe(0);
    expect(hidden.highlighted.size).toBe(0);
  });
});

describe('StationCloseStepAnimation', () => {
  test('fades a station its last line stops calling at, and frames it', () => {
    // D closes on red in 1960; green comes only in 1970.
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1959-01-01');
    expect(animation).toBeInstanceOf(StationCloseStepAnimation);
    expect(draw(0.25).fading).toEqual(new Map([['d', 0.75]]));
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('d')]);
  });

  test('keeps a station another line still calls at, unless that line is hidden', () => {
    const network = tinyNetwork();
    network.segments[2]!.lines.green!.open = '1955-01-01';
    const { draw } = stepAfter(network, '1959-01-01');
    expect(draw(0.25).fading.size).toBe(0);
    expect(draw(0.25, { hidden: ['green'] }).fading).toEqual(new Map([['d', 0.75]]));
  });
});

describe('RenameStepAnimation', () => {
  test('highlights the station renamed, and frames it', () => {
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1924-01-01');
    expect(animation).toBeInstanceOf(RenameStepAnimation);
    expect(animation.changesIdentity).toBe(false);
    expect([...draw(0.5).highlighted]).toEqual(['d']);
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('d')]);
  });
});

describe('IdentityStepAnimation', () => {
  test('frames the line taking its own identity, and leaves the blend to the network layer', () => {
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1989-01-01');
    expect(animation).toBeInstanceOf(IdentityStepAnimation);
    expect(animation.changesIdentity).toBe(true);
    expect(animation.cameraPoints()).toEqual(playback.index.segments[0]!.coordinates);
    const drawing = draw(0.5);
    expect([drawing.lines.features, drawing.heads.features, [...drawing.reached], [...drawing.highlighted], [...drawing.fading]]).toEqual([[], [], [], [], []]);
  });
});
