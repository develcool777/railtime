import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/model/date.utils';
import { describeSteps } from '../../../src/steps/stepAnimation.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('StepAnimationUtils', () => {
  describe('describeSteps', () => {
    test('describes every step as its caption, planned ones last and undated', () => {
      const playback = playbackOf(tinyNetwork(), 'extension');
      const changes = describeSteps(renderStateOf(playback));
      expect(changes.map(change => change.index)).toEqual(playback.timeline.steps.map(step => step.index));
      expect(changes[0]).toMatchObject({ kind: 'open', time: toTimestamp('1900-01-01'), title: 'Red line opens', color: '#ff0000' });
      expect(changes.slice(-2).map(change => change.time)).toEqual([null, null]);
      expect(changes.at(-2)).toMatchObject({ title: 'Red line extended', subtitle: 'D – E' });
    });
  });
});
