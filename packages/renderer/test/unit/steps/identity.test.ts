import { describe, expect, test } from 'vitest';
import { IdentityStepAnimation } from '../../../src/steps/identity.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { stepAfter } from '../../support/stepFrames.utils';

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
