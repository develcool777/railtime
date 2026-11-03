import { describe, expect, test } from 'vitest';
import { YEAR_MS, toTimestamp } from '@railtime/core/date.utils';
import { FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from '../../../src/playback/player.constants';
import { planOnlyNetwork } from '@railtime/network/testing/planOnlyNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { playbackOf } from '../../support/playback.utils';

describe('Player', () => {
  test('stops on each step and plays it through its phases to the end', () => {
    const { facts, timeline, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.on(toTimestamp('1899-06-01')));
    player.play();
    const events: string[] = [];
    for (let frame = 0; frame < 20000 && player.playing; frame++) events.push(...player.tick(1 / 30).map(event => event.type));
    expect(events.filter(type => type === 'stepStart')).toHaveLength(timeline.steps.length);
    expect(events.at(-1)).toBe('end');
    expect(player.cursor).toBe(timeline.steps.length);
  });

  test("opens at today; plays a plan's steps after every dated one, the clock standing at the end", () => {
    const { timeline, player } = playbackOf(tinyNetwork(), { plan: 'extension' });
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

  test('tells where it is as a playhead: the changes done, the clock, and how far the next one has been drawn', () => {
    const { facts, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.on(toTimestamp('1905-01-01')));
    expect(player.playhead).toEqual({ cursor: 1, time: toTimestamp('1905-01-01'), progress: 0 });
    player.skip();
    player.play();
    player.tick(1);
    player.tick(player.active!.animation.drawSeconds / 2);
    expect(player.playhead).toEqual({ cursor: 1, time: toTimestamp('1910-01-01'), progress: expect.closeTo(0.5) });
  });

  test("seeks a change drawn in part, past the camera's beat, and plays it on from there", () => {
    const { facts, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.after(1, 0.25));
    expect([player.phase, player.cursor]).toEqual(['draw', 1]);
    expect(player.playhead).toEqual({ ...facts.playheads.after(1, 0.25), progress: expect.closeTo(0.25) });
    player.play();
    expect(player.tick(player.active!.animation.drawSeconds).map(event => event.type)).toEqual([]);
    expect(player.phase).toBe('hold');
    // Past the last change there is nothing to draw.
    player.seek({ ...facts.playheads.end(), progress: 0.5 });
    expect(player.active).toBeNull();
  });

  test("holds the clock to the change's years: from the last done's date to the next one's, history's start before any", () => {
    const { facts, timeline, player } = playbackOf(tinyNetwork());
    const [first, second] = timeline.steps;
    player.seek({ cursor: 1, time: toTimestamp('1850-01-01'), progress: 0 });
    expect(player.clock).toBe(first!.time);
    player.seek({ cursor: 1, time: toTimestamp('1990-01-01'), progress: 0 });
    expect([player.cursor, player.clock]).toEqual([1, second!.time]);
    player.seek({ cursor: 0, time: toTimestamp('1990-01-01'), progress: 0 });
    expect([player.cursor, player.clock]).toEqual([0, first!.time]);
    player.seek({ cursor: -2, time: toTimestamp('1800-01-01'), progress: 0 });
    expect([player.cursor, player.clock]).toEqual([0, timeline.start]);
    expect(facts.playheads.after(0).time).toBe(timeline.start);
  });

  test('jumps to the end, the plan built', () => {
    const { facts, timeline, player } = playbackOf(tinyNetwork(), { plan: 'extension' });
    player.seek(facts.playheads.end());
    expect(player.cursor).toBe(timeline.steps.length);
    expect(player.inFuture).toBe(true);
    player.seek(facts.playheads.on(toTimestamp('1950-01-01')));
    expect(player.inFuture).toBe(false);
  });

  test('skips to the next step, then finishes it', () => {
    const { facts, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.on(toTimestamp('1899-06-01')));
    expect(player.skip().map(event => event.type)).toEqual(['stepStart']);
    expect(player.skip().map(event => event.type)).toEqual(['stepEnd']);
    expect(player.cursor).toBe(1);
  });

  test('jumps to just before a step, so playing starts it, or just past it, on its date', () => {
    const { facts, timeline, player } = playbackOf(tinyNetwork(), { plan: 'extension' });
    const dated = timeline.steps[2]!;
    player.seek(facts.playheads.after(3));
    expect(player.cursor).toBe(3);
    expect(player.clock).toBe(dated.time);
    player.seek(facts.playheads.before(2));
    expect(player.cursor).toBe(2);
    player.play();
    expect(player.tick(1 / 30).map(event => event.type)).toEqual(['stepStart']);
    expect(player.active?.animation.step).toBe(dated);
    // A planned step stands at the end, in the future.
    player.seek(facts.playheads.after(timeline.datedCount + 1));
    expect(player.clock).toBe(player.end);
    expect(player.inFuture).toBe(true);
  });

  test('runs the clock fast through quiet years and slows steadily into the next change, never with a jolt', () => {
    const { facts, timeline, player } = playbackOf(tinyNetwork());
    // Five years before red reaches C, D in 1910.
    player.seek(facts.playheads.on(toTimestamp('1905-01-01')));
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
    const { facts, player } = playbackOf(tinyNetwork());
    // Red's 1910 stretch: 1 s for the camera, then drawn (its 2 km, and a stop at D), then held 1.2 s.
    player.seek(facts.playheads.on(toTimestamp('1905-01-01')));
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
    const drawSeconds = player.active!.animation.drawSeconds;
    player.tick(drawSeconds / 2);
    // Linear: each kind of step eases it as it draws.
    expect(player.progress).toBeCloseTo(0.5);
    player.tick(drawSeconds / 2);
    expect([player.phase, player.progress]).toEqual(['hold', 1]);
    expect(player.holdProgress).toBeCloseTo(0, 6);
    player.tick(0.6);
    expect(player.holdProgress).toBeCloseTo(0.5);
    expect(player.tick(0.6).map(event => event.type)).toEqual(['stepEnd']);
    expect([player.phase, player.progress, player.holdProgress, player.cursor]).toEqual([null, 0, 0, 2]);
  });

  test('plays faster at a higher speed, and not at all while paused', () => {
    const { facts, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.on(toTimestamp('1905-01-01')));
    player.skip();
    expect(player.tick(5)).toEqual([]);
    expect(player.active?.elapsed).toBe(0);
    player.play();
    player.setSpeed(2);
    player.tick(0.25);
    expect(player.active?.elapsed).toBe(0.5);
    // Between steps, the clock runs twice as fast too.
    const { facts: betweenFacts, player: between } = playbackOf(tinyNetwork());
    // Nine quiet years before green opens in 1970: the clock runs at its fastest.
    between.seek(betweenFacts.playheads.on(toTimestamp('1961-01-01')));
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
    fresh.player.seek(fresh.facts.playheads.after(fresh.timeline.steps.length));
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
    const { facts, timeline, player } = playbackOf(tinyNetwork());
    player.seek(facts.playheads.end());
    expect(player.skip()).toEqual([]);
    player.seek(facts.playheads.before(999));
    expect(player.cursor).toBe(timeline.steps.length - 1);
    player.seek(facts.playheads.before(-5));
    expect(player.cursor).toBe(0);
  });

  describe('commands', () => {
    test('starts again at the end: history from its first date, a network with a plan from today, where it starts', () => {
      const history = playbackOf(tinyNetwork());
      history.player.seek(history.facts.playheads.end());
      history.player.play();
      expect([history.player.clock, history.player.playing]).toEqual([toTimestamp('1899-01-01'), true]);
      const plan = playbackOf(tinyNetwork(), { plan: 'extension' });
      plan.player.seek(plan.facts.playheads.end());
      plan.player.play();
      expect([plan.player.clock, plan.player.cursor]).toEqual([plan.player.today, plan.timeline.datedCount]);
      const planOnly = playbackOf(planOnlyNetwork(), { plan: 'first' });
      planOnly.player.seek(planOnly.facts.playheads.end());
      planOnly.player.play();
      expect([planOnly.player.clock, planOnly.player.cursor]).toEqual([planOnly.player.today, 0]);
    });

    test('plays on from here, but from the start again once at the end', () => {
      const { facts, player, timeline } = playbackOf(tinyNetwork());
      player.seek(facts.playheads.on(toTimestamp('1935-01-01')));
      player.play();
      expect(player.clock).toBe(toTimestamp('1935-01-01'));
      player.seek(facts.playheads.end());
      player.play();
      expect(player.clock).toBe(timeline.start);
    });

    test('plays from just before a change, so it plays again', () => {
      const { facts, player } = playbackOf(tinyNetwork());
      player.play(facts.playheads.before(3));
      expect([player.cursor, player.playing]).toEqual([3, true]);
    });

    test('keeps playing or paused as it seeks; at the end, where all has played, playing ends on the next frame', () => {
      const { facts, player, timeline } = playbackOf(tinyNetwork());
      player.play();
      player.seek(facts.playheads.on(toTimestamp('1935-01-01')));
      expect(player.playing).toBe(true);
      player.seek(facts.playheads.after(3));
      expect([player.cursor, player.playing]).toEqual([3, true]);
      player.seek(facts.playheads.end());
      expect([player.cursor, player.playing]).toEqual([timeline.steps.length, true]);
      expect(player.tick(1 / 30).map(event => event.type)).toEqual(['end']);
      player.seek(facts.playheads.today());
      expect([player.clock, player.playing]).toEqual([player.today, false]);
    });

    test('steps a year at a time, within the timeline', () => {
      const { facts, player, timeline } = playbackOf(tinyNetwork());
      player.seek(facts.playheads.on(toTimestamp('1935-06-01')));
      player.stepYear(-1);
      expect(player.clock).toBe(toTimestamp('1935-06-01') - YEAR_MS);
      player.seek(facts.playheads.on(timeline.start));
      player.stepYear(-1);
      expect(player.clock).toBe(timeline.start);
      player.seek(facts.playheads.today());
      player.stepYear(1);
      expect(player.clock).toBe(player.end);
    });

    test('goes back to the change before the one playing, or the one before the last played', () => {
      const { facts, player } = playbackOf(tinyNetwork());
      player.seek(facts.playheads.after(5));
      player.previousChange();
      expect(player.cursor).toBe(3);
      player.play(facts.playheads.before(4));
      player.skip();
      expect(player.active?.animation.step.index).toBe(4);
      player.previousChange();
      expect([player.cursor, player.active]).toEqual([3, null]);
    });
  });
});
