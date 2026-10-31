import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { CloseStepAnimation } from '../../../src/steps/close.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('CloseStepAnimation', () => {
  /**
   * The caption of the close step after a date.
   *
   * @param date - A day before the closure.
   * @returns Its caption.
   */
  const captionAfter = (date: string) => {
    const playback = playbackOf(tinyNetwork());
    playback.player.seek(toTimestamp(date));
    playback.player.skip();
    const animation = playback.player.active!.animation;
    expect(animation).toBeInstanceOf(CloseStepAnimation);
    return animation.describe(renderStateOf(playback));
  };

  test('says a section is suspended when its line will return, and closes when it will not', () => {
    expect(captionAfter('1939-01-01')).toMatchObject({ title: 'Blue line: section suspended', subtitle: 'B – C' });
    expect(captionAfter('1949-01-01')).toMatchObject({ title: 'Blue line: section closes', subtitle: 'B – C' });
  });
});
