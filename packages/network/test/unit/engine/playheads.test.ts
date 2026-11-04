import { toTimestamp } from '@railtime/core/date.utils';
import { describe, expect, test } from 'vitest';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

/** Today, as the tests' facts have it. */
const TODAY = toTimestamp('2026-01-01');

describe('Playheads', () => {
  test('stands at the end of a day with every change on it or before done', () => {
    const { playheads, engine } = factsOf(tinyNetwork());
    expect(playheads.on(toTimestamp('1905-06-01'))).toEqual({ cursor: 1, time: toTimestamp('1905-06-01'), progress: 0 });
    expect(playheads.on(engine.timeline.steps[1]!.time).cursor).toBe(2);
    expect(playheads.today()).toEqual({ cursor: engine.timeline.cursorAt(TODAY), time: TODAY, progress: 0 });
  });

  test("puts the clock on the last change done's date, history's start for none, or the next one's while it is drawn", () => {
    const { playheads, range, engine } = factsOf(tinyNetwork());
    const [first, second] = engine.timeline.steps;
    expect(playheads.after(0)).toEqual({ cursor: 0, time: range.start, progress: 0 });
    expect(playheads.after(1)).toEqual({ cursor: 1, time: first!.time, progress: 0 });
    expect(playheads.after(1, 0.4)).toEqual({ cursor: 1, time: second!.time, progress: 0.4 });
    // Drawn whole, the change is done.
    expect(playheads.after(1, 1)).toEqual(playheads.after(2));
  });

  test('keeps to the timeline: no cursor past its changes, nothing to draw after the last', () => {
    const { playheads, range, engine } = factsOf(tinyNetwork());
    const count = engine.timeline.steps.length;
    expect(playheads.after(-3)).toEqual(playheads.after(0));
    expect(playheads.after(count + 5)).toEqual(playheads.after(count));
    expect(playheads.after(count, 0.5).progress).toBe(0);
    expect(playheads.end()).toEqual({ cursor: count, time: range.end, progress: 0 });
  });

  test("plays a plan's changes at the end of the range, the network ending with them all done", () => {
    const { playheads, range, engine } = factsOf(tinyNetwork(), 'extension');
    const dated = engine.timeline.datedCount;
    expect(playheads.after(dated, 0.5)).toEqual({ cursor: dated, time: range.end, progress: 0.5 });
    expect(playheads.after(dated + 1).time).toBe(range.end);
    expect(playheads.end().cursor).toBe(engine.timeline.steps.length);
    expect(playheads.end().cursor).toBeGreaterThan(factsOf(tinyNetwork()).playheads.end().cursor);
  });

  test('stands just before a change on its date, so playing plays it at once', () => {
    const { playheads, engine } = factsOf(tinyNetwork(), 'extension');
    const { steps, datedCount } = engine.timeline;
    expect(playheads.before(1)).toEqual({ cursor: 1, time: steps[1]!.time, progress: 0 });
    expect(playheads.before(datedCount).time).toBe(playheads.end().time);
    expect(playheads.before(99)).toEqual(playheads.before(steps.length - 1));
  });

  test("holds a playhead to the history: its cursor to the timeline, its clock to its change's years, a part drawn on its date", () => {
    const { playheads, range, engine } = factsOf(tinyNetwork());
    const { steps } = engine.timeline;
    expect(playheads.hold({ cursor: 1, time: toTimestamp('1850-01-01'), progress: 0 }).time).toBe(steps[0]!.time);
    expect(playheads.hold({ cursor: 1, time: toTimestamp('1990-01-01'), progress: 0 })).toEqual({ cursor: 1, time: steps[1]!.time, progress: 0 });
    expect(playheads.hold({ cursor: -2.5, time: toTimestamp('1800-01-01'), progress: 0 })).toEqual({ cursor: 0, time: range.start, progress: 0 });
    expect(playheads.hold({ cursor: 1, time: 0, progress: 0.3 })).toEqual({ cursor: 1, time: steps[1]!.time, progress: 0.3 });
    // Drawn whole and held, until it is done; nothing to draw after the last.
    expect(playheads.hold({ cursor: 1, time: 0, progress: 4 }).progress).toBe(1);
    expect(playheads.hold({ ...playheads.end(), progress: 0.5 })).toEqual(playheads.end());
    expect(playheads.hold({ cursor: 99, time: toTimestamp('2100-01-01'), progress: 0 })).toEqual(playheads.end());
  });

  test("starts playing from history's first date, or for a network with a plan from today, where its plan starts", () => {
    const history = factsOf(tinyNetwork());
    expect(history.playheads.start()).toEqual({ cursor: 0, time: history.range.start, progress: 0 });
    const planned = factsOf(tinyNetwork(), 'extension');
    expect(planned.playheads.start()).toEqual(planned.playheads.today());
  });

  test("plays a change on its own date, and a plan's at the end of the range", () => {
    const { playheads, range, engine } = factsOf(tinyNetwork(), 'extension');
    const { steps, datedCount } = engine.timeline;
    expect(playheads.dateOf(0)).toBe(steps[0]!.time);
    expect(playheads.dateOf(datedCount)).toBe(range.end);
    expect(() => playheads.dateOf(steps.length)).toThrow();
  });

  test('rests today, or for a network with a plan at the end, the plan built; and knows a playhead there, to the day', () => {
    const history = factsOf(tinyNetwork()).playheads;
    const planned = factsOf(tinyNetwork(), 'extension').playheads;
    expect(history.rest()).toEqual(history.today());
    expect(planned.rest()).toEqual(planned.end());
    expect(history.isRest({ ...history.today(), time: TODAY + 3_600_000 })).toBe(true);
    expect(history.isRest(history.on(toTimestamp('2025-06-01')))).toBe(false);
    expect([planned.isToday(planned.today()), planned.isRest(planned.today())]).toEqual([true, false]);
    expect(history.isToday({ ...history.today(), progress: 0.5 })).toBe(false);
  });

  test('is in a plan once a planned change is done, or being drawn, and never in a network without one', () => {
    const { playheads, engine } = factsOf(tinyNetwork(), 'extension');
    const dated = engine.timeline.datedCount;
    expect(playheads.inPlan(playheads.today())).toBe(false);
    expect(playheads.inPlan(playheads.after(dated, 0.1))).toBe(true);
    expect(playheads.inPlan(playheads.end())).toBe(true);
    const history = factsOf(tinyNetwork()).playheads;
    expect(history.inPlan(history.end())).toBe(false);
  });
});
