import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { InfillStepAnimation } from '../../../src/steps/infill.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { stepAfter } from '../../support/stepFrames.utils';

describe('InfillStepAnimation', () => {
  test('puts the station on its line and highlights it while its step plays, not only once it is over', () => {
    // C opens on red, on track red has run over since 1910.
    const { animation, draw, state, playback } = stepAfter(tinyNetwork(), '1915-01-01');
    expect(animation).toBeInstanceOf(InfillStepAnimation);
    const drawing = draw(0.1);
    expect([...drawing.highlighted]).toEqual(['c']);
    expect(drawing.reached.get('c')).toEqual(new Map([['red', '#ff0000']]));
    // A lone station starts and ends where it stands.
    expect(animation.startPoint()).toEqual(animation.cameraPoints()[0]);
    expect(animation.describe(state)).toEqual({
      kind: 'infill',
      time: toTimestamp('1920-06-01'),
      title: 'C opens',
      subtitle: 'on the Red line',
      color: '#ff0000',
      stations: ['C'],
    });
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('c')]);
  });

  test('names every line the station opens on, and adds nothing for a hidden one', () => {
    const network = tinyNetwork();
    network.stations.c!.infill = { red: '1935-01-01', blue: '1935-01-01' };
    const { animation, draw, state } = stepAfter(network, '1934-01-01');
    expect(animation.describe(state)).toMatchObject({ subtitle: 'on the Red line and Blue line' });
    const hidden = draw(0.5, { hidden: ['red', 'blue'] });
    expect(hidden.reached.size).toBe(0);
    expect(hidden.highlighted.size).toBe(0);
  });
});
