import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { StationCloseStepAnimation } from '../../../src/steps/stationClose.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { stepAfter } from '../../support/stepFrames.utils';

describe('StationCloseStepAnimation', () => {
  test('fades a station its last line stops calling at, and frames it', () => {
    // D closes on red in 1960; green comes only in 1970.
    const { animation, draw, state, playback } = stepAfter(tinyNetwork(), '1959-01-01');
    expect(animation).toBeInstanceOf(StationCloseStepAnimation);
    expect(animation.describe(state)).toEqual({
      kind: 'stationClose',
      time: toTimestamp('1960-01-01'),
      title: 'D closes',
      subtitle: 'on the Red line',
      color: '#ff0000',
      stations: [],
    });
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
