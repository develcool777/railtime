import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/networkSnapshot.utils';
import { toTimestamp } from '../../../src/model/date.utils';
import { OpenStepAnimation } from '../../../src/steps/openStep.service';
import { emptyDrawing } from '../../../src/steps/stepAnimation.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('OpenStepAnimation', () => {
  test('highlights the stations a stretch opens as the growth front passes them', () => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(toTimestamp('1905-01-01'));
    playback.player.skip();
    const animation = playback.player.active!.animation as OpenStepAnimation;
    expect(animation).toBeInstanceOf(OpenStepAnimation);
    const frameAt = (progress: number) => {
      const state = renderStateOf(playback);
      const drawing = emptyDrawing();
      animation.draw({ state, snapshot: buildNetworkSnapshot(state, true), progress, holdProgress: 0 }, drawing);
      return drawing;
    };
    // Half-way the front has passed C, but C is an infill station: it does not open on red until 1920.
    expect([...frameAt(0.5).highlighted]).toEqual([]);
    expect([...frameAt(1).highlighted]).toEqual(['d']);
    // D opened in 1910 under its name then, Old D.
    expect(animation.describe(renderStateOf(playback))).toMatchObject({ title: 'Red line extended', stations: ['C', 'Old D'] });
  });

  test('says a line back on track it left reopens', () => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(toTimestamp('1944-01-01'));
    playback.player.skip();
    expect(playback.player.active!.animation.describe(renderStateOf(playback))).toMatchObject({ title: 'Blue line reopens', subtitle: 'B – C' });
  });
});
