import type { Network } from '@railtime/schema/network.types';
import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CloseStepAnimation } from '../../../src/steps/close.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
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
  test('says a section is suspended when its line will return, and closes when it will not', () => {
    const suspended = stepAfter(tinyNetwork(), '1939-01-01');
    expect(suspended.animation).toBeInstanceOf(CloseStepAnimation);
    expect(suspended.animation.describe(suspended.state)).toEqual({
      kind: 'close',
      time: toTimestamp('1940-01-01'),
      title: 'Blue line: section suspended',
      subtitle: 'B – C',
      color: '#0000ff',
      stations: [],
    });
    const closes = stepAfter(tinyNetwork(), '1949-01-01');
    expect(closes.animation.describe(closes.state)).toMatchObject({ title: 'Blue line: section closes', subtitle: 'B – C' });
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
