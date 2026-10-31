import { describe, expect, test } from 'vitest';
import { YEAR_MS, toTimestamp } from '@railtime/core/date.utils';
import { FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from '../../../src/playback/player.constants';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { playbackOf } from '../../support/playback.utils';

describe('Player', () => {
  test('stops on each step and plays it through its phases to the end', () => {
    const { timeline, player } = playbackOf(tinyNetwork());
    player.seek({ time: toTimestamp('1899-06-01') });
    player.play();
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
    player.play();
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
    player.seek('future');
    expect(player.cursor).toBe(timeline.steps.length);
    expect(player.inFuture).toBe(true);
    player.seek({ time: toTimestamp('1950-01-01') });
    expect(player.inFuture).toBe(false);
  });

  test('skips to the next step, then finishes it', () => {
    const { player } = playbackOf(tinyNetwork());
    player.seek({ time: toTimestamp('1899-06-01') });
    expect(player.skip().map(event => event.type)).toEqual(['stepStart']);
    expect(player.skip().map(event => event.type)).toEqual(['stepEnd']);
    expect(player.cursor).toBe(1);
  });

  test('jumps to just before a step, so playing starts it, or just past it, on its date', () => {
    const { timeline, player } = playbackOf(tinyNetwork(), 'extension');
    const dated = timeline.steps[2]!;
    player.seek({ change: 2 });
    expect(player.cursor).toBe(3);
    expect(player.clock).toBe(dated.time);
    player.seek({ beforeChange: 2 });
    expect(player.cursor).toBe(2);
    player.play();
    expect(player.tick(1 / 30).map(event => event.type)).toEqual(['stepStart']);
    expect(player.active?.animation.step).toBe(dated);
    // A planned step stands at the end, in the future.
    player.seek({ change: timeline.datedCount });
    expect(player.clock).toBe(player.end);
    expect(player.inFuture).toBe(true);
  });

  test('runs the clock fast through quiet years and slows steadily into the next change, never with a jolt', () => {
    const { timeline, player } = playbackOf(tinyNetwork());
    // Five years before red reaches C, D in 1910.
    player.seek({ time: toTimestamp('1905-01-01') });
    player.play();
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

  test('plays a step through its phases at their exact edges: a beat for the camera, the change drawn, then held', () => {
    const { player } = playbackOf(tinyNetwork());
    // Red's 1910 stretch: 1 s for the camera, 1 s to draw its 2 km, held 1.2 s for its two new stations.
    player.seek({ time: toTimestamp('1905-01-01') });
    expect([player.phase, player.progress, player.holdProgress]).toEqual([null, 0, 0]);
    player.skip();
    player.play();
    expect(player.phase).toBe('pre');
    expect(player.progress).toBeCloseTo(0);
    expect(player.holdProgress).toBe(0);
    player.tick(0.5);
    expect(player.phase).toBe('pre');
    player.tick(0.5);
    expect(player.phase).toBe('draw');
    expect(player.progress).toBeCloseTo(0);
    player.tick(0.5);
    expect(player.progress).toBeCloseTo(0.5);
    player.tick(0.5);
    expect([player.phase, player.progress, player.holdProgress]).toEqual(['hold', 1, 0]);
    player.tick(0.6);
    expect(player.holdProgress).toBeCloseTo(0.5);
    expect(player.tick(0.6).map(event => event.type)).toEqual(['stepEnd']);
    expect([player.phase, player.progress, player.holdProgress, player.cursor]).toEqual([null, 0, 0, 2]);
  });

  test('plays faster at a higher speed, and not at all while paused', () => {
    const { player } = playbackOf(tinyNetwork());
    player.seek({ time: toTimestamp('1905-01-01') });
    player.skip();
    expect(player.tick(5)).toEqual([]);
    expect(player.active?.elapsed).toBe(0);
    player.play();
    player.setSpeed(2);
    player.tick(0.25);
    expect(player.active?.elapsed).toBe(0.5);
    // Between steps, the clock runs twice as fast too.
    const between = playbackOf(tinyNetwork()).player;
    // Nine quiet years before green opens in 1970: the clock runs at its fastest.
    between.seek({ time: toTimestamp('1961-01-01') });
    between.play();
    between.setSpeed(2);
    const before = between.clock;
    between.tick(0.01);
    expect((between.clock - before) / YEAR_MS).toBeCloseTo(2 * FAST_YEARS_PER_SECOND * 0.01);
  });

  test('ends at today, or at a change dated after it, with the clock there', () => {
    const later = tinyNetwork();
    later.segments[2]!.lines.green!.open = '2030-01-01';
    const { player, timeline } = playbackOf(later);
    expect(player.end).toBe(toTimestamp('2030-01-01'));
    expect(playbackOf(tinyNetwork()).player.end).toBe(player.today);
    expect(timeline.lastDate).toBe(player.end);
    // From past the last change, the clock runs on to the end before playback stops.
    const fresh = playbackOf(tinyNetwork());
    fresh.player.seek({ change: fresh.timeline.steps.length - 1 });
    fresh.player.play();
    const events: string[] = [];
    let frames = 0;
    for (; frames < 5000 && fresh.player.playing; frames++) {
      events.push(...fresh.player.tick(1 / 30).map(event => event.type));
      if (fresh.player.playing) expect(fresh.player.clock).toBeLessThan(fresh.player.end);
    }
    expect(events).toEqual(['end']);
    // 36 years from 1990, at 4 a second at most: seconds of frames, not one.
    expect(frames).toBeGreaterThan(200);
    expect(fresh.player.clock).toBe(fresh.player.end);
  });

  test('skips nothing past the last step, and seeks to the first or last step for a place outside them', () => {
    const { timeline, player } = playbackOf(tinyNetwork());
    player.seek('future');
    expect(player.skip()).toEqual([]);
    player.seek({ beforeChange: 999 });
    expect(player.cursor).toBe(timeline.steps.length - 1);
    player.seek({ beforeChange: -5 });
    expect(player.cursor).toBe(0);
  });

  describe('commands', () => {
    test('plays history from its first date, and a plan from today, where its future starts', () => {
      const history = playbackOf(tinyNetwork()).player;
      history.play('start');
      expect(history.clock).toBe(toTimestamp('1899-01-01'));
      expect(history.playing).toBe(true);
      const plan = playbackOf(tinyNetwork(), 'extension').player;
      plan.play('start');
      expect(plan.clock).toBe(plan.today);
    });

    test('plays on from here, but from the start again once at the end', () => {
      const { player, timeline } = playbackOf(tinyNetwork());
      player.seek({ time: toTimestamp('1935-01-01') });
      player.play();
      expect(player.clock).toBe(toTimestamp('1935-01-01'));
      player.seek('future');
      player.play();
      expect(player.clock).toBe(timeline.start);
    });

    test('plays from just before a change, so it plays again', () => {
      const { player } = playbackOf(tinyNetwork());
      player.play({ change: 3 });
      expect([player.cursor, player.playing]).toEqual([3, true]);
    });

    test('keeps playing or paused as it seeks; the future, where all has played, pauses', () => {
      const { player, timeline } = playbackOf(tinyNetwork());
      player.play();
      player.seek({ time: toTimestamp('1935-01-01') });
      expect(player.playing).toBe(true);
      player.seek({ change: 2 });
      expect([player.cursor, player.playing]).toEqual([3, true]);
      player.seek('future');
      expect([player.cursor, player.playing]).toEqual([timeline.steps.length, false]);
      player.seek('today');
      expect([player.clock, player.playing]).toEqual([player.today, false]);
    });

    test('steps a year at a time, within the timeline', () => {
      const { player, timeline } = playbackOf(tinyNetwork());
      player.seek({ time: toTimestamp('1935-06-01') });
      player.stepYear(-1);
      expect(player.clock).toBe(toTimestamp('1935-06-01') - YEAR_MS);
      player.seek({ time: timeline.start });
      player.stepYear(-1);
      expect(player.clock).toBe(timeline.start);
      player.seek('today');
      player.stepYear(1);
      expect(player.clock).toBe(player.end);
    });

    test('goes back to the change before the one playing, or the one before the last played', () => {
      const { player } = playbackOf(tinyNetwork());
      player.seek({ change: 4 });
      player.previousChange();
      expect(player.cursor).toBe(3);
      player.play({ change: 4 });
      player.skip();
      expect(player.active?.animation.step.index).toBe(4);
      player.previousChange();
      expect([player.cursor, player.active]).toEqual([3, null]);
    });
  });
});
