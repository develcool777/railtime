import { describe, expect, test } from 'vitest';
import { YEAR_MS, toTimestamp } from '../../../src/core/date.utils';
import { FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from '../../../src/playback/player.constants';
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

  test("opens at today; plays a plan's steps after every dated one, the clock standing at the end", () => {
    const { timeline, player } = playbackOf(tinyNetwork(), 'extension');
    expect(player.clock).toBe(player.today);
    expect(player.cursor).toBe(timeline.datedCount);
    expect(player.inFuture).toBe(false);
    player.playing = true;
    const started: boolean[] = [];
    for (let frame = 0; frame < 2000 && player.playing; frame++) {
      for (const event of player.tick(1 / 30)) if (event.type === 'stepStart') started.push(event.playback.animation.step.planned);
      if (player.active) expect(player.inFuture).toBe(true);
      expect(player.clock).toBe(player.end);
    }
    expect(started).toEqual([true, true]);
    expect(player.cursor).toBe(timeline.steps.length);
  });

  test('jumps to the end, the plan built', () => {
    const { timeline, player } = playbackOf(tinyNetwork(), 'extension');
    player.seekEnd();
    expect(player.cursor).toBe(timeline.steps.length);
    expect(player.inFuture).toBe(true);
    player.seek(toTimestamp('1950-01-01'));
    expect(player.inFuture).toBe(false);
  });

  test('skips to the next step, then finishes it', () => {
    const { player } = playbackOf(tinyNetwork());
    player.seek(toTimestamp('1899-06-01'));
    expect(player.skip().map(event => event.type)).toEqual(['stepStart']);
    expect(player.skip().map(event => event.type)).toEqual(['stepEnd']);
    expect(player.cursor).toBe(1);
  });

  test('jumps to just before a step, so playing starts it, or just past it, on its date', () => {
    const { timeline, player } = playbackOf(tinyNetwork(), 'extension');
    const dated = timeline.steps[2]!;
    player.seekPast(2);
    expect(player.cursor).toBe(3);
    expect(player.clock).toBe(dated.time);
    player.seekBefore(2);
    expect(player.cursor).toBe(2);
    player.playing = true;
    expect(player.tick(1 / 30).map(event => event.type)).toEqual(['stepStart']);
    expect(player.active?.animation.step).toBe(dated);
    // A planned step stands at the end, in the future.
    player.seekPast(timeline.datedCount);
    expect(player.clock).toBe(player.end);
    expect(player.inFuture).toBe(true);
  });

  test('runs the clock fast through quiet years and slows steadily into the next change, never with a jolt', () => {
    const { timeline, player } = playbackOf(tinyNetwork());
    // Five years before red reaches C, D in 1910.
    player.seek(toTimestamp('1905-01-01'));
    player.playing = true;
    const frame = 1 / 60;
    const speeds: number[] = [];
    for (let tick = 0; tick < 1000 && !player.active; tick++) {
      const before = player.clock;
      player.tick(frame);
      if (!player.active) speeds.push((player.clock - before) / YEAR_MS / frame);
    }
    expect(player.active?.animation.step).toBe(timeline.steps[1]);
    expect(speeds[0]).toBeCloseTo(FAST_YEARS_PER_SECOND);
    expect(speeds.at(-1)).toBeCloseTo(SLOW_YEARS_PER_SECOND);
    // Frame to frame, the speed changes by a few per cent at most.
    for (const [position, speed] of speeds.entries()) if (position > 0) expect(Math.abs(speed - speeds[position - 1]!) / speed).toBeLessThan(0.05);
  });
});
