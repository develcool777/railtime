import { toTimestamp } from '@railtime/core/date.utils';
import type { PlanId } from '@railtime/schema/network.types';
import { planId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { engineOf } from '../../../src/engine/engine.utils';
import { NetworkFacts } from '../../../src/facts/facts.service';
import { hiddenNetwork } from '../../support/factories/hiddenNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

/** Today, as the tests' facts have it. */
const TODAY = toTimestamp('2026-01-01');

describe('Playheads', () => {
  test('stands at the end of a day with every change on it or before done', () => {
    const facts = factsOf(tinyNetwork());
    const { playheads } = facts;
    const engine = engineOf(facts);
    expect(playheads.on(toTimestamp('1905-06-01'))).toEqual({ cursor: 1, time: toTimestamp('1905-06-01'), progress: 0 });
    expect(playheads.on(engine.timeline.steps[1]!.time).cursor).toBe(2);
    expect(playheads.today()).toEqual({ cursor: engine.timeline.cursorAt(TODAY), time: TODAY, progress: 0 });
  });

  test("puts the clock on the last change done's date, history's start for none, or the next one's while it is drawn", () => {
    const facts = factsOf(tinyNetwork());
    const { playheads, range } = facts;
    const engine = engineOf(facts);
    const [first, second] = engine.timeline.steps;
    expect(playheads.after(0)).toEqual({ cursor: 0, time: range.start, progress: 0 });
    expect(playheads.after(1)).toEqual({ cursor: 1, time: first!.time, progress: 0 });
    expect(playheads.after(1, 0.4)).toEqual({ cursor: 1, time: second!.time, progress: 0.4 });
    // Drawn whole, the change is done.
    expect(playheads.after(1, 1)).toEqual(playheads.after(2));
  });

  test('keeps to the timeline: no cursor past its changes, nothing to draw after the last', () => {
    const facts = factsOf(tinyNetwork());
    const { playheads, range } = facts;
    const engine = engineOf(facts);
    const count = engine.timeline.steps.length;
    expect(playheads.after(-3)).toEqual(playheads.after(0));
    expect(playheads.after(count + 5)).toEqual(playheads.after(count));
    expect(playheads.after(count, 0.5).progress).toBe(0);
    expect(playheads.end()).toEqual({ cursor: count, time: range.end, progress: 0 });
  });

  test("plays a plan's changes at the end of the range, the network ending with them all done", () => {
    const facts = factsOf(tinyNetwork(), planId('extension'));
    const { playheads, range } = facts;
    const engine = engineOf(facts);
    const dated = engine.timeline.datedCount;
    expect(playheads.after(dated, 0.5)).toEqual({ cursor: dated, time: range.end, progress: 0.5 });
    expect(playheads.after(dated + 1).time).toBe(range.end);
    expect(playheads.end().cursor).toBe(engine.timeline.steps.length);
    expect(playheads.end().cursor).toBeGreaterThan(factsOf(tinyNetwork()).playheads.end().cursor);
  });

  test('stands just before a change on its date, so playing plays it at once', () => {
    const facts = factsOf(tinyNetwork(), planId('extension'));
    const { playheads } = facts;
    const engine = engineOf(facts);
    const { steps, datedCount } = engine.timeline;
    expect(playheads.before(1)).toEqual({ cursor: 1, time: steps[1]!.time, progress: 0 });
    expect(playheads.before(datedCount).time).toBe(playheads.end().time);
    expect(playheads.before(99)).toEqual(playheads.before(steps.length - 1));
  });

  test("holds a playhead to the history: its cursor to the timeline, its clock to its change's years, a part drawn on its date", () => {
    const facts = factsOf(tinyNetwork());
    const { playheads, range } = facts;
    const engine = engineOf(facts);
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
    const planned = factsOf(tinyNetwork(), planId('extension'));
    expect(planned.playheads.start()).toEqual(planned.playheads.today());
  });

  test("plays a change on its own date, and a plan's at the end of the range", () => {
    const facts = factsOf(tinyNetwork(), planId('extension'));
    const { playheads, range } = facts;
    const engine = engineOf(facts);
    const { steps, datedCount } = engine.timeline;
    expect(playheads.dateOf(0)).toBe(steps[0]!.time);
    expect(playheads.dateOf(datedCount)).toBe(range.end);
    expect(() => playheads.dateOf(steps.length)).toThrow(`Missing step ${steps.length}`);
  });

  test('rests today, or for a network with a plan at the end, the plan built; and knows a playhead there, to the day', () => {
    const history = factsOf(tinyNetwork()).playheads;
    const planned = factsOf(tinyNetwork(), planId('extension')).playheads;
    expect(history.rest()).toEqual(history.today());
    expect(planned.rest()).toEqual(planned.end());
    expect(history.isRest({ ...history.today(), time: TODAY + 3_600_000 })).toBe(true);
    expect(history.isRest(history.on(toTimestamp('2025-06-01')))).toBe(false);
    expect([planned.isToday(planned.today()), planned.isRest(planned.today())]).toEqual([true, false]);
    expect(history.isToday({ ...history.today(), progress: 0.5 })).toBe(false);
  });

  test('is in a plan once a planned change is done, or being drawn, and never in a network without one', () => {
    const facts = factsOf(tinyNetwork(), planId('extension'));
    const { playheads } = facts;
    const engine = engineOf(facts);
    const dated = engine.timeline.datedCount;
    expect(playheads.inPlan(playheads.today())).toBe(false);
    expect(playheads.inPlan(playheads.after(dated, 0.1))).toBe(true);
    expect(playheads.inPlan(playheads.end())).toBe(true);
    const history = factsOf(tinyNetwork()).playheads;
    expect(history.inPlan(history.end())).toBe(false);
  });

  describe('moment, atMoment', () => {
    /** The hidden network's lines all shown: `blue` closes and `grey` opens on 1 January 1950, two changes on a day. */
    const shown = (plan?: PlanId) => NetworkFacts.create(hiddenNetwork(), { ...(plan && { plan }), hidden: [], today: TODAY });
    const day = toTimestamp('1950-01-01');
    /** The first of that day's changes. */
    const first = engineOf(shown()).timeline.cursorAt(day - 1);

    test('says a change to the hundredth, the rounding in one place: a whole one done, none of it where the clock stands', () => {
      const { playheads } = shown();
      expect(playheads.hundredths(0.4321)).toBe(43);
      expect(playheads.toHundredth(playheads.after(first, 0.4321))).toEqual(playheads.after(first, 0.43));
      expect(playheads.toHundredth({ ...playheads.after(first, 0.5), progress: 0.998 })).toEqual(playheads.after(first + 1));
      const quiet = playheads.on(toTimestamp('1905-06-01'));
      expect(playheads.toHundredth({ ...quiet, progress: 0.001 })).toEqual(quiet);
    });

    test('names a day with its changes all done by the day alone, to the day, quiet or not', () => {
      const { playheads } = shown();
      const quiet = toTimestamp('1905-06-01');
      expect(playheads.moment(playheads.on(quiet))).toEqual({ day: quiet });
      expect(playheads.moment({ ...playheads.on(quiet), time: quiet + 3_600_000 })).toEqual({ day: quiet });
      expect(playheads.moment(playheads.on(day))).toEqual({ day });
    });

    test("names a day's changes in part by how many are done and how far the next is drawn", () => {
      const { playheads } = shown();
      expect(playheads.moment(playheads.before(first))).toEqual({ day, partway: { done: 0, progress: 0 } });
      expect(playheads.moment(playheads.after(first, 0.4))).toEqual({ day, partway: { done: 0, progress: 0.4 } });
      expect(playheads.moment(playheads.after(first + 1))).toEqual({ day, partway: { done: 1, progress: 0 } });
    });

    test("names a plan's changes by how far through them, as they have no date", () => {
      const facts = factsOf(tinyNetwork(), planId('extension'));
      const { playheads } = facts;
      const engine = engineOf(facts);
      const dated = engine.timeline.datedCount;
      expect(playheads.moment(playheads.after(dated, 0.5))).toEqual({ day: null, partway: { done: 0, progress: 0.5 } });
      expect(playheads.moment(playheads.after(dated + 1))).toEqual({ day: null, partway: { done: 1, progress: 0 } });
      expect(playheads.moment(playheads.end())).toEqual({ day: null });
      expect(playheads.moment(playheads.today())).toEqual({ day: TODAY });
    });

    test('takes back every place it names', () => {
      const facts = shown(planId('grey-on'));
      const { playheads } = facts;
      const dated = engineOf(facts).timeline.datedCount;
      const places = [
        playheads.on(toTimestamp('1905-06-01')),
        playheads.on(day),
        playheads.before(first),
        playheads.after(first, 0.4),
        playheads.after(first + 1),
        playheads.today(),
        playheads.after(dated, 0.5),
        playheads.end(),
      ];
      expect(places.map(place => playheads.atMoment(playheads.moment(place)))).toEqual(places);
    });

    test('stands on the same day on facts with other changes, as many of them done as it has', () => {
      const all = shown();
      const hidden = NetworkFacts.create(hiddenNetwork(), { today: TODAY });
      expect(engineOf(hidden).timeline.cursorAt(day)).not.toBe(engineOf(all).timeline.cursorAt(day));
      expect(all.playheads.atMoment(hidden.playheads.moment(hidden.playheads.on(day)))).toEqual(all.playheads.on(day));
      const partway = all.playheads.moment(all.playheads.after(first + 1));
      expect(hidden.playheads.atMoment(partway)).toEqual(hidden.playheads.on(day));
    });

    test('stands at the end of a day with none of the changes asked for, and rests where a plan has none', () => {
      const { playheads } = shown();
      const quiet = toTimestamp('1905-06-01');
      expect(playheads.atMoment({ day: quiet, partway: { done: 0, progress: 0.5 } })).toEqual(playheads.on(quiet));
      expect(playheads.atMoment({ day, partway: { done: 99, progress: 0 } })).toEqual(playheads.on(day));
      expect(playheads.atMoment({ day: null, partway: { done: 1, progress: 0.5 } })).toEqual(playheads.rest());
      expect(playheads.atMoment({ day: null })).toEqual(playheads.rest());
    });

    test("holds a playhead from another network's timeline to this one first", () => {
      const { playheads } = shown();
      expect(playheads.moment({ cursor: 999, time: Infinity, progress: 0 })).toEqual(playheads.moment(playheads.end()));
    });
  });
});
