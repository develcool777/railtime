import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { RenameStepAnimation } from '../../../src/steps/rename.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { stepAfter } from '../../support/stepFrames.utils';

describe('RenameStepAnimation', () => {
  test('says what the station was called and is now, and highlights it', () => {
    const { animation, draw, state, playback } = stepAfter(tinyNetwork(), '1924-01-01');
    expect(animation).toBeInstanceOf(RenameStepAnimation);
    expect(animation.changesIdentity).toBe(false);
    expect(animation.describe(state)).toEqual({
      kind: 'rename',
      time: toTimestamp('1925-01-01'),
      title: 'Old D renamed',
      subtitle: 'now D',
      color: '#ff0000',
      stations: ['D'],
    });
    expect([...draw(0.5).highlighted]).toEqual(['d']);
    expect(animation.cameraPoints()).toEqual([playback.index.coordOf('d')]);
  });
});
