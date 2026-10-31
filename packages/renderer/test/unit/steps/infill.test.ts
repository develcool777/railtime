import { describe, expect, test } from 'vitest';
import { toTimestamp } from '../../../src/core/date.utils';
import { buildNetworkSnapshot } from '../../../src/layers/snapshot.utils';
import { emptyDrawing } from '../../../src/steps/animation.utils';
import { InfillStepAnimation } from '../../../src/steps/infill.service';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('InfillStepAnimation', () => {
  test('puts the station on its line and highlights it while its step plays, not only once it is over', () => {
    const playback = playbackOf(tinyNetwork());
    // C opens on red, on track red has run over since 1910.
    playback.player.seek(toTimestamp('1915-01-01'));
    playback.player.skip();
    const animation = playback.player.active!.animation;
    expect(animation).toBeInstanceOf(InfillStepAnimation);
    const state = renderStateOf(playback);
    const drawing = emptyDrawing();
    animation.draw({ state, snapshot: buildNetworkSnapshot(state, true), progress: 0.1, holdProgress: 0 }, drawing);
    expect([...drawing.highlighted]).toEqual(['c']);
    expect(drawing.reached.get('c')).toEqual(new Map([['red', '#ff0000']]));
    expect(animation.describe(state)).toMatchObject({ title: 'C opens', subtitle: 'on the Red line' });
  });
});
