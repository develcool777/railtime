import { describe, expect, test } from 'vitest';
import { InfillStepAnimation } from '../../../src/steps/infill.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { stepAfter } from '../../support/stepFrames.utils';

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
