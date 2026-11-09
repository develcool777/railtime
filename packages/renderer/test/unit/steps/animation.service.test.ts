import { toTimestamp } from '@railtime/core/date.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { Step } from '@railtime/network/engine.types';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { Network } from '@railtime/schema/network.types';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { CLOSE_HOLD_SECONDS, GROWTH_PACE, OPEN_HOLD_SECONDS, UNTOUCHED_BASE } from '../../../src/steps/animation.constants';
import { StepAnimation } from '../../../src/steps/animation.service';
import { emptyDrawing, frontKmAt, growthSeconds, sameBase } from '../../../src/steps/animation.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';
import { stepAfter } from '../../support/stepFrames.utils';

/** Degrees of longitude in a km on the test line, as the tiny network places its stations. */
const ONE_KM = 0.0144;
/**
 * The tiny network with blue also on a branch from D to a station E of its own, drawn from E, which
 * closes with blue's B – C in 1950: E is left with no line.
 *
 * @returns The network.
 */
const withBranch = (): Network => {
  const network = tinyNetwork();
  network.stations[stationId('e')] = { name: 'E', coordinate: [4 * ONE_KM, 51.5] };
  network.segments.push({
    stationA: stationId('e'),
    stationB: stationId('d'),
    lines: { [lineId('blue')]: { open: '1930-01-01', close: '1950-01-01' } },
    coordinates: [
      [4 * ONE_KM, 51.5],
      [3 * ONE_KM, 51.5],
    ],
  });
  return network;
};

describe('StepAnimation', () => {
  describe('every kind', () => {
    test('frames and draws every kind of step from start to end', () => {
      const playback = playbackOf(tinyNetwork(), { plan: planId('extension') });
      const { index, timeline } = playback;
      const kinds = new Set<string>();
      for (const step of timeline.steps) {
        playback.player.seek(playback.facts.playheads.before(step.index));
        const animation = new StepAnimation(step, { index, timeline, view: '2d' as const });
        kinds.add(step.kind);
        expect(animation.step).toBe(step);
        expect(animation.drawSeconds).toBeGreaterThan(0);
        expect(animation.holdSeconds).toBeGreaterThan(0);
        expect(animation.cameraPoints().length).toBeGreaterThan(0);
        const state = { ...renderStateOf(playback), base: animation.baseAt('draw', 0.5) };
        const snapshot = buildNetworkSnapshot(state);
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
          for (const feature of [...drawing.lines.features, ...drawing.growing.features]) expect(feature.properties.color).toMatch(/^#[0-9a-f]{6}$/);
          for (const opacity of drawing.fading.values()) expect(opacity).toBeGreaterThanOrEqual(0);
        }
      }
      expect(kinds).toEqual(new Set(['open', 'close', 'infill', 'stationClose', 'rename', 'identity']));
    });

    test("draws a plan's stretch as the map draws a plan, dashed, while it grows and once it has", () => {
      const playback = playbackOf(tinyNetwork(), { plan: planId('extension') });
      const { index, timeline } = playback;
      const state = renderStateOf(playback);
      const plannedOf = (step: (typeof timeline.steps)[number]) => {
        playback.player.seek(playback.facts.playheads.before(step.index));
        const drawing = emptyDrawing();
        new StepAnimation(step, { index, timeline, view: '2d' }).draw(
          { state, snapshot: buildNetworkSnapshot(state), progress: 0.5, holdProgress: 0 },
          drawing,
        );
        return [...drawing.lines.features, ...drawing.growing.features].map(feature => feature.properties.planned);
      };
      const openings = timeline.steps.filter(step => step.kind === 'open');
      expect(openings.filter(step => step.planned).flatMap(plannedOf)).toContain(true);
      expect(openings.filter(step => step.planned).flatMap(plannedOf)).not.toContain(false);
      expect(openings.filter(step => !step.planned).flatMap(plannedOf)).not.toContain(true);
    });
  });
});

describe('StepAnimation, opening a stretch', () => {
  /** Red's 1910 stretch: from B, already on the map, on to C and D, 1 km each. */
  const extension = () => stepAfter(tinyNetwork(), '1905-01-01');

  test('highlights the stations a stretch opens as the growth front passes them', () => {
    const { animation, draw } = extension();
    expect(animation.step.kind).toBe('open');
    // Half-way the front has passed C, but C is an infill station: it does not open on red until 1920.
    expect([...draw(0.5).highlighted]).toEqual([]);
    expect([...draw(1).highlighted]).toEqual(['d']);
    // D opened in 1910 under its name then, Old D.
  });

  test('grows more slowly in 3D, where the camera follows it at street level', () => {
    const playback = playbackOf(tinyNetwork(), { view: '3d' });
    playback.player.seek(playback.facts.playheads.on(toTimestamp('1905-01-01')));
    playback.player.skip();
    const pace = GROWTH_PACE['3d'];
    const animation = playback.player.active!.animation;
    // Its 2 km, and a stop at D, the one station it opens.
    expect(animation.drawSeconds).toBe(growthSeconds([animation.stretch!.growth.totalKm], animation.stretch!.growth.totalKm, pace));
    expect(animation.drawSeconds).toBeGreaterThan(extension().animation.drawSeconds);
    expect(pace.kmPerSecond).toBeLessThan(GROWTH_PACE['2d'].kmPerSecond);
    expect(pace.stationSeconds).toBeGreaterThan(GROWTH_PACE['2d'].stationSeconds);
  });

  test('takes as long as its runs between stops at one pace and a stop at each new station, however long, and holds as long as any', () => {
    const animation = extension().animation;
    // The one stop is D, at its end: C opens later.
    expect(animation.drawSeconds).toBe(growthSeconds([animation.stretch!.growth.totalKm], animation.stretch!.growth.totalKm, GROWTH_PACE['2d']));
    expect(animation.holdSeconds).toBe(OPEN_HOLD_SECONDS);
  });

  test('grows out of the network along its track, a head at the front, and frames all of it', () => {
    const { animation, draw, playback } = extension();
    const { totalKm } = animation.stretch!.growth;
    const quarter = draw(0.25);
    // Still growing: the piece sent each frame; nothing yet drawn whole.
    expect([quarter.lines.features, quarter.growing.features.length]).toEqual([[], 1]);
    const [growing] = quarter.growing.features;
    expect(growing?.geometry.coordinates[0]).toEqual([ONE_KM, 51.5]);
    // A camera following it starts where it grows from: B.
    expect(animation.startPoint()).toEqual([ONE_KM, 51.5]);
    // A quarter of its time in, as far as the front has run then, east of B.
    const quarterKm = frontKmAt(animation.drawSeconds / 4, [totalKm], totalKm, GROWTH_PACE['2d']);
    expect(growing?.geometry.coordinates.at(-1)?.[0]).toBeCloseTo(ONE_KM + (quarterKm / totalKm) * 2 * ONE_KM, 4);
    expect(growing?.properties).toMatchObject({ color: '#ff0000', highlight: 1 });
    expect(quarter.heads.features.map(head => head.geometry.coordinates)).toEqual([growing?.geometry.coordinates.at(-1)]);
    expect(quarter.heads.features[0]?.properties).toEqual({ color: '#ff0000' });
    // Fully drawn: both segments whole, no head; the highlight fades as it holds, for all of it at once.
    const drawn = draw(1, { holdProgress: 0.25 });
    expect([drawn.lines.features.length, drawn.growing.features]).toEqual([2, []]);
    expect(drawn.heads.features).toEqual([]);
    expect(drawn.highlight).toBe(0.75);
    expect(animation.cameraPoints()).toEqual([...playback.index.segments[1]!.coordinates, ...playback.index.segments[2]!.coordinates]);
  });

  test('runs through a station that opens later at full pace, and waits at the one it opens, the camera there with it', () => {
    const { animation, draw } = extension();
    const pace = GROWTH_PACE['2d'];
    /** Where the front is after some seconds, km past B: the furthest the track is drawn. */
    const frontAt = (seconds: number) =>
      Math.max(
        ...[...draw(seconds / animation.drawSeconds).lines.features, ...draw(seconds / animation.drawSeconds).growing.features].flatMap(feature =>
          feature.geometry.coordinates.map(point => point[0]),
        ),
      ) /
        ONE_KM -
      1;
    // Past C, a km on, without slowing: a tenth of a second covers a tenth of the pace.
    expect(frontAt(0.5) - frontAt(0.4)).toBeCloseTo(pace.kmPerSecond / 10, 1);
    // Waiting at D, the camera still told where it is.
    expect(frontAt(animation.drawSeconds - pace.stationSeconds / 2)).toBeCloseTo(2, 2);
    expect(draw(1).chase?.center[0]).toBeCloseTo(3 * ONE_KM, 6);
  });

  test('links a station it reaches to the one it changes to as the front gets there, not once the stretch is drawn', () => {
    // D, which red reaches last, changes to A, on the map since 1900.
    const { draw, playback } = extension();
    const early = draw(0.3);
    expect([early.links.features, [...early.linked]]).toEqual([[], []]);
    const reached = draw(1);
    expect(reached.links.features.map(link => link.geometry.coordinates)).toEqual([
      [playback.index.coordOf(stationId('d')), playback.index.coordOf(stationId('a'))],
    ]);
    expect([...reached.linked].toSorted(byCodeUnits)).toEqual(['a', 'd']);
  });
});

describe('StepAnimation, closing track', () => {
  test('plays a section suspended, or closing for good, as a close', () => {
    expect(stepAfter(tinyNetwork(), '1939-01-01').animation.step.kind).toBe('close');
    expect(stepAfter(tinyNetwork(), '1949-01-01').animation.step.kind).toBe('close');
  });

  test('retracts a stretch as one front, from its far end back to the network that stays, at the pace an opening grows', () => {
    // Blue closes D – E alone in 1951: E leaves the map, D stays on red.
    const network = withBranch();
    network.segments.at(-1)!.lines[lineId('blue')]!.close = '1951-01-01';
    const { animation, draw, playback } = stepAfter(network, '1950-06-01');
    const pace = GROWTH_PACE['2d'];
    // A stop at E as it fades, then 1 km back to D.
    expect(animation.drawSeconds).toBeCloseTo(growthSeconds([0], 1, pace));
    expect(animation.holdSeconds).toBe(CLOSE_HOLD_SECONDS);
    expect(animation.startPoint()).toEqual(playback.index.coordOf(stationId('e')));
    const after = (seconds: number) => draw(seconds / animation.drawSeconds);
    // Waiting at E: the track still whole, E half faded.
    const waiting = after(pace.stationSeconds / 2);
    expect(waiting.lines.features.map(feature => feature.geometry.coordinates[0])).toEqual([[3 * ONE_KM, 51.5]]);
    expect(waiting.growing.features).toEqual([]);
    expect(waiting.fading.get(stationId('e'))).toBeCloseTo(0.5);
    // Half-way back: what is left runs from D, and the camera faces D, the way the front goes.
    const half = after(pace.stationSeconds + growthSeconds([], 1, pace) / 2);
    const [left] = half.growing.features.map(feature => feature.geometry.coordinates);
    expect(left?.[0]).toEqual([3 * ONE_KM, 51.5]);
    // D – E is a hair short of 1 km.
    expect(left?.at(-1)?.[0]).toBeCloseTo(3.5 * ONE_KM, 4);
    expect(half.growing.features.every(feature => feature.properties.color === '#0000ff')).toBe(true);
    expect(half.chase?.ahead[0]).toBeLessThan(half.chase?.behind[0] ?? 0);
    // Closing track never stands out as new track does.
    expect(half.highlight).toBe(0);
    expect(half.fading.get(stationId('e'))).toBe(0);
    // Gone at the end.
    expect(draw(1).growing.features).toEqual([]);
    expect(draw(1).lines.features).toEqual([]);
  });

  test('plays each connected stretch closing on one day as its own step', () => {
    // Blue closes B – C and D – E in 1950: two stretches, apart.
    const { playback } = stepAfter(withBranch(), '1949-01-01');
    const closes = playback.timeline.steps.filter(step => step.kind === 'close' && step.time === toTimestamp('1950-01-01'));
    expect(closes.map(step => step.kind === 'close' && step.lineSegments.map(({ segment }) => `${segment.stationA}–${segment.stationB}`))).toEqual([
      ['b–c'],
      ['e–d'],
    ]);
  });
});

describe('StepAnimation, a station opening on its line', () => {
  test('puts the station on its line and highlights it while its step plays, not only once it is over', () => {
    // C opens on red, on track red has run over since 1910.
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1915-01-01');
    expect(animation.step.kind).toBe('infill');
    const drawing = draw(0.1);
    expect([...drawing.highlighted]).toEqual(['c']);
    expect(drawing.reached.get(stationId('c'))).toEqual(new Map([['red', '#ff0000']]));
    // A lone station starts and ends where it stands.
    expect(animation.startPoint()).toEqual(animation.cameraPoints()[0]);
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf(stationId('c'))]);
  });
});

describe('StepAnimation, a station closing', () => {
  test('fades a station its last line stops calling at, and frames it', () => {
    // D closes on red in 1960; green comes only in 1970.
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1959-01-01');
    expect(animation.step.kind).toBe('stationClose');
    // Eased: half-way through its time, half gone.
    expect(draw(0.5).fading).toEqual(new Map([['d', 0.5]]));
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf(stationId('d'))]);
  });

  test('keeps a station another line still calls at', () => {
    const network = tinyNetwork();
    network.segments[2]!.lines[lineId('green')]!.open = '1955-01-01';
    const { draw } = stepAfter(network, '1959-01-01');
    expect(draw(0.5).fading.size).toBe(0);
  });
});

describe('StepAnimation, a station closed for a spell', () => {
  test('fades it as a closing for now, and brings it back as a reopening', () => {
    // Both lines calling at B close it for the spell: no line keeps it on the map.
    const spell = [{ from: '1915-03-15', until: '1926-07-19' }];
    const network = tinyNetwork();
    network.stations[stationId('b')] = { ...network.stations[stationId('b')]!, suspended: { [lineId('red')]: spell, [lineId('pink')]: spell } };
    const closing = stepAfter(network, '1915-01-01');
    expect(closing.animation.step).toMatchObject({ kind: 'stationClose', station: 'b', temporary: true });
    expect(closing.draw(0.5).fading).toEqual(new Map([['b', 0.5]]));
    expect([...closing.draw(0.5).spells]).toEqual(['b']);
    const reopening = stepAfter(network, '1926-01-01');
    expect(reopening.animation.step).toMatchObject({ kind: 'infill', station: 'b', reopening: true });
    expect([...reopening.draw(0.5).highlighted]).toEqual(['b']);
    expect([...reopening.draw(0.5).spells]).toEqual(['b']);
  });
});

describe('StepAnimation, the network under it', () => {
  /**
   * Each kind's first step, as it plays.
   *
   * @param kind - The kind.
   * @returns Its animation, and the track it opens or closes.
   */
  const animationOf = (kind: Step['kind']) => {
    const { index, timeline } = playbackOf(tinyNetwork());
    const step = timeline.steps.find(candidate => candidate.kind === kind)!;
    return { animation: new StepAnimation(step, { index, timeline, view: '2d' }), track: new Set('lineSegments' in step ? step.lineSegments : []) };
  };

  test('an opening has what is on the map make room from the start, and takes nothing from it', () => {
    const { animation, track } = animationOf('open');
    expect((['pre', 'draw', 'hold'] as const).map(phase => animation.baseAt(phase, 0))).toEqual([
      { ...UNTOUCHED_BASE, makesRoom: track },
      { ...UNTOUCHED_BASE, makesRoom: track },
      { ...UNTOUCHED_BASE, makesRoom: track },
    ]);
  });

  test('a closure leaves its stretch whole while the camera gets there, and takes it from the network as it retracts', () => {
    const { animation, track } = animationOf('close');
    expect(animation.baseAt('pre', 0)).toBe(UNTOUCHED_BASE);
    expect(animation.baseAt('draw', 0.5)).toEqual({ ...UNTOUCHED_BASE, leavesOut: track });
    expect(animation.baseAt('hold', 1)).toEqual({ ...UNTOUCHED_BASE, leavesOut: track });
  });

  test('lines blend as they are drawn, eased, and stay blended as they are held; before that, none is', () => {
    const { animation } = animationOf('identity');
    expect(animation.baseAt('pre', 0).blend).toBeNull();
    expect(animation.baseAt('draw', 0).blend).toBeCloseTo(0);
    expect(animation.baseAt('draw', 0.25).blend).toBeLessThan(0.25);
    expect(animation.baseAt('draw', 0.5).blend).toBeCloseTo(0.5);
    expect(animation.baseAt('hold', 1).blend).toBe(1);
  });

  test("a station's change leaves the network as it is", () => {
    for (const kind of ['infill', 'stationClose', 'rename'] as const) expect(animationOf(kind).animation.baseAt('draw', 0.5)).toBe(UNTOUCHED_BASE);
  });

  test('says the same as long as its phase and blend are the same, and only then', () => {
    const closure = animationOf('close').animation;
    expect(sameBase(closure.baseAt('draw', 0.2), closure.baseAt('hold', 1))).toBe(true);
    expect(sameBase(closure.baseAt('pre', 0), closure.baseAt('draw', 0))).toBe(false);
    const opening = animationOf('open').animation;
    expect(sameBase(opening.baseAt('pre', 0), opening.baseAt('draw', 0.5))).toBe(true);
    expect(sameBase(opening.baseAt('pre', 0), UNTOUCHED_BASE)).toBe(false);
    const blending = animationOf('identity').animation;
    expect(sameBase(blending.baseAt('draw', 0.4), blending.baseAt('draw', 0.4))).toBe(true);
    expect(sameBase(blending.baseAt('draw', 0.4), blending.baseAt('draw', 0.5))).toBe(false);
  });
});

describe('StepAnimation, a station renamed', () => {
  test('highlights the station renamed with the name it had, and frames it', () => {
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1924-01-01');
    expect(animation.step.kind).toBe('rename');
    expect([...draw(0.5).highlighted]).toEqual(['d']);
    expect(draw(0.5).renamed).toEqual(new Map([['d', 'Old D']]));
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf(stationId('d'))]);
  });
});

describe('StepAnimation, lines taking their own colour', () => {
  test('frames only the track on the map as a line takes its own colour, not track it opens later', () => {
    const network = tinyNetwork();
    // Pink reaches C – D only in 2000, after it took its own colour.
    network.segments[2]!.lines[lineId('pink')] = { open: '2000-01-01' };
    const { animation, playback } = stepAfter(network, '1989-01-01');
    expect(animation.step.kind).toBe('identity');
    expect(animation.cameraPoints()).toEqual(playback.index.segments[0]!.coordinates);
  });

  test('frames the line taking its own identity, and draws nothing of its own: the blend is in the network under it', () => {
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1989-01-01');
    expect(animation.step.kind).toBe('identity');
    expect(animation.cameraPoints()).toEqual(playback.index.segments[0]!.coordinates);
    const drawing = draw(0.5);
    expect([
      drawing.lines.features,
      drawing.growing.features,
      drawing.heads.features,
      [...drawing.reached],
      [...drawing.highlighted],
      [...drawing.fading],
      [...drawing.renamed],
    ]).toEqual([[], [], [], [], [], [], []]);
  });
});
