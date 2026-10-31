import { describe, expect, test } from 'vitest';
import { toTimestamp } from '@railtime/core/date.utils';
import { GROWTH_PACE, HOLD_BASE_SECONDS, HOLD_PER_STATION_SECONDS } from '../../../src/steps/animation.constants';
import { OpenStepAnimation } from '../../../src/steps/open.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { playbackOf } from '../../support/playback.utils';
import { stepAfter } from '../../support/stepFrames.utils';

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
