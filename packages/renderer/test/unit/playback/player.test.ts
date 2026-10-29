import { describe, expect, test } from 'vitest';
import { buildNetworkSnapshot } from '../../../src/layers/networkSnapshot.utils';
import { toTimestamp } from '../../../src/model/date.utils';
import { emptyDrawing } from '../../../src/steps/stepAnimation.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { cityNetwork } from '../../support/fixtures/datasets.utils';
import { playbackOf, renderStateOf } from '../../support/playback.utils';

describe('Player', () => {
  test('stops on each step and plays it through its phases to the end', () => {
    const { timeline, player } = playbackOf(tinyNetwork());
    player.seek(toTimestamp('1899-06-01'));
    player.playing = true;
    const events: string[] = [];
    for (let frame = 0; frame < 20000 && player.playing; frame++) events.push(...player.tick(1 / 30).map(event => event.type));
    expect(events.filter(type => type === 'stepStart')).toHaveLength(timeline.steps.length);
    expect(events.at(-1)).toBe('end');
    expect(player.cursor).toBe(timeline.steps.length);
  });

  test('skips to the next step, then finishes it', () => {
    const { player } = playbackOf(tinyNetwork());
    player.seek(toTimestamp('1899-06-01'));
    expect(player.skip().map(event => event.type)).toEqual(['stepStart']);
    expect(player.skip().map(event => event.type)).toEqual(['stepEnd']);
    expect(player.cursor).toBe(1);
  });
});

describe.each(['london', 'tyne-and-wear', 'manchester'])('Player on %s', city => {
  test('plays its whole history, every step, drawing frames without errors', () => {
    const playback = playbackOf(cityNetwork(city));
    const { timeline, player } = playback;
    player.seek(timeline.start);
    player.playing = true;
    const frameSeconds = 1 / 20;
    let elapsed = 0;
    let started = 0;
    let mostHighlighted = 0;
    let frame = 0;
    while (player.playing && elapsed < 7200) {
      started += player.tick(frameSeconds).filter(event => event.type === 'stepStart').length;
      elapsed += frameSeconds;
      frame += 1;
      if (frame % 5 !== 0 || !player.active || player.phase === 'pre') continue;
      const state = renderStateOf(playback);
      const drawing = emptyDrawing();
      player.active.animation.draw(
        { state, snapshot: buildNetworkSnapshot(state, true), progress: player.progress, holdProgress: player.holdProgress },
        drawing,
      );
      mostHighlighted = Math.max(mostHighlighted, drawing.highlighted.size);
    }
    expect(started).toBe(timeline.steps.length);
    expect(player.cursor).toBe(timeline.steps.length);
    expect(mostHighlighted).toBeGreaterThan(5);
    // London takes about 11 minutes at 1×.
    expect(elapsed).toBeLessThan(20 * 60);
  });
});
