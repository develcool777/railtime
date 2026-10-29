import { describe, expect, test } from 'vitest';
import { applyPlan } from '@railtime/schema/plan.utils';
import { toTimestamp } from '../../../src/model/date.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { playbackOf } from '../../support/playback.utils';

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

  test('opens at today, and runs on to the last planned change after it', () => {
    const { timeline, player } = playbackOf(applyPlan(tinyNetwork(), 'extension'));
    expect(player.clock).toBe(player.today);
    expect(player.cursor).toBe(timeline.steps.length - 1);
    expect(player.end).toBe(toTimestamp('2030-01-01'));
  });

  test('skips to the next step, then finishes it', () => {
    const { player } = playbackOf(tinyNetwork());
    player.seek(toTimestamp('1899-06-01'));
    expect(player.skip().map(event => event.type)).toEqual(['stepStart']);
    expect(player.skip().map(event => event.type)).toEqual(['stepEnd']);
    expect(player.cursor).toBe(1);
  });
});
