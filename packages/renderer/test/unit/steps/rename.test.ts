import { describe, expect, test } from 'vitest';
import { RenameStepAnimation } from '../../../src/steps/rename.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { stepAfter } from '../../support/stepFrames.utils';

describe('RenameStepAnimation', () => {
  test('highlights the station renamed, and frames it', () => {
    const { animation, draw, playback } = stepAfter(tinyNetwork(), '1924-01-01');
    expect(animation).toBeInstanceOf(RenameStepAnimation);
    expect(animation.changesIdentity).toBe(false);
    expect([...draw(0.5).highlighted]).toEqual(['d']);
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('d')]);
  });
});
