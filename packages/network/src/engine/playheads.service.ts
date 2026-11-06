import { DAY_MS } from '@railtime/core/date.utils';
import { clamp } from '@railtime/core/number.utils';
import { required } from '@railtime/core/required.utils';
import { PROGRESS_STEPS } from './engine.constants.ts';
import type { Timeline } from './timeline.service';
import type { Moment, Playhead } from '../facts/facts.types';

/**
 * Where in its history the map can be, as a `Playhead`, and the one place its rules are: the date each
 * change plays on, the years the clock may stand in after one, where playing starts. The player seeks
 * through `hold` and runs its clock to `dateOf`; the app asks for one on a day, after or before a change,
 * today or at the end (`NetworkFacts.playheads`). A cursor means something only to the facts it came
 * from: what outlives them, as an address does, holds a `Moment` (`moment`, `atMoment`).
 */
export class Playheads {
  /** The network's history as steps. */
  private readonly timeline: Timeline;
  /** The timeline's first date, its end and today, as timestamps. */
  private readonly range: { start: number; end: number; today: number };

  public constructor(timeline: Timeline, range: { start: number; end: number; today: number }) {
    this.timeline = timeline;
    this.range = range;
  }

  /**
   * At the end of a day, as a date is asked for: every change on it or before done.
   *
   * @param day - A timestamp on that day.
   * @returns The playhead.
   */
  public on(day: number): Playhead {
    return this.hold({ cursor: this.timeline.cursorAt(day), time: day, progress: 0 });
  }

  /**
   * After so many changes, the next drawn so far: the clock on the last one's date (history's start
   * for none), or on the next one's while it is drawn. Drawn whole, it is done.
   *
   * @param cursor - The changes done; clamped to the timeline.
   * @param progress - How far the next has been drawn, 0 to 1.
   * @returns The playhead.
   */
  public after(cursor: number, progress = 0): Playhead {
    if (progress >= 1) return this.after(Math.floor(cursor) + 1);
    // As early in its change's years as the clock may stand.
    return this.hold({ cursor, time: -Infinity, progress });
  }

  /**
   * With so many changes done, just before the next, on its date: playing, it plays at once.
   *
   * @param cursor - The changes done, which is the next change's position in the timeline (`ChangeInfo.index`); clamped to the timeline's changes.
   * @returns The playhead.
   */
  public before(cursor: number): Playhead {
    // As late in its change's years as the clock may stand: the next one's date.
    return this.hold({ cursor: Math.min(cursor, this.timeline.steps.length - 1), time: Infinity, progress: 0 });
  }

  /**
   * Today: every dated change on it or before done.
   *
   * @returns The playhead.
   */
  public today(): Playhead {
    return this.on(this.range.today);
  }

  /**
   * Where playing from the start begins: history's first date; for a network with a plan, today, where
   * its plan starts.
   *
   * @returns The playhead.
   */
  public start(): Playhead {
    return this.hasPlan ? this.today() : this.on(this.range.start);
  }

  /**
   * Where the map rests, which the app leaves out of its address and comes back to: today; for a
   * network with a plan, the end, the plan built.
   *
   * @returns The playhead.
   */
  public rest(): Playhead {
    return this.hasPlan ? this.end() : this.today();
  }

  /**
   * How far a change has been drawn, in hundredths: the one place its progress is rounded.
   *
   * @param progress - How far, 0 to 1.
   * @returns The whole hundredths.
   */
  public hundredths(progress: number): number {
    return Math.round(progress * PROGRESS_STEPS);
  }

  /**
   * A playhead as a link says it, to the hundredth of a change: one that comes to a whole change is
   * after it (`after`), and one with none of it drawn stays where its clock stands.
   *
   * @param playhead - Where the map is.
   * @returns The playhead.
   */
  public toHundredth(playhead: Playhead): Playhead {
    const progress = this.hundredths(playhead.progress) / PROGRESS_STEPS;
    return progress > 0 ? this.after(playhead.cursor, progress) : { ...playhead, progress };
  }

  /**
   * A playhead as a moment: its day, and how far through that day's changes (a plan's, in a plan) unless
   * they are all done. To the day: a clock between two changes keeps no hours.
   *
   * @param playhead - Where the map is.
   * @returns The moment, for `atMoment`.
   */
  public moment(playhead: Playhead): Moment {
    const held = this.hold(playhead);
    const day = this.inPlan(held) ? null : Math.floor(held.time / DAY_MS) * DAY_MS;
    const { first, last } = this.changesOf(day);
    return held.cursor < last ? { day, partway: { done: held.cursor - first, progress: held.progress } } : { day };
  }

  /**
   * Where a moment is in this history: on its day, as far through its changes as it says, as many as the
   * day has here. Past them, or on a day with none, it is the day's end, as a date is asked for; past a
   * plan's, or with no plan, where the map rests.
   *
   * @param moment - The moment.
   * @returns The playhead.
   */
  public atMoment(moment: Moment): Playhead {
    const { day, partway } = moment;
    const { first, last } = this.changesOf(day);
    if (partway && first + partway.done < last) return this.hold({ cursor: first + partway.done, time: day ?? this.range.end, progress: partway.progress });
    return day === null ? this.rest() : this.on(day);
  }

  /**
   * Whether a playhead is today's: the same changes done, nothing drawn, the clock on today.
   *
   * @param playhead - Where the map is.
   * @returns True if it is today's.
   */
  public isToday(playhead: Playhead): boolean {
    return this.samePlace(playhead, this.today());
  }

  /**
   * Whether a playhead is where the map rests (`rest`).
   *
   * @param playhead - Where the map is.
   * @returns True if it rests there.
   */
  public isRest(playhead: Playhead): boolean {
    return this.samePlace(playhead, this.rest());
  }

  /**
   * Whether a playhead is in a plan: a planned change done, or one being drawn.
   *
   * @param playhead - Where the map is.
   * @returns True if it is in the plan.
   */
  public inPlan(playhead: Playhead): boolean {
    const dated = this.timeline.datedCount;
    return playhead.cursor > dated || (playhead.cursor === dated && playhead.progress > 0 && this.hasPlan);
  }

  /**
   * The end: every change done, a plan's too, the clock at the end of the range.
   *
   * @returns The playhead.
   */
  public end(): Playhead {
    return { cursor: this.timeline.steps.length, time: this.range.end, progress: 0 };
  }

  /**
   * A playhead held to the history: its cursor to the timeline; its clock to its change's years, from the
   * last change done's date (history's start for none) to the next one's (the end after the last); a
   * change drawn in part on its own date, up to drawn whole (1, held), and nothing drawn after the last.
   *
   * @param playhead - Where asked for.
   * @returns Where it can be.
   */
  public hold(playhead: Playhead): Playhead {
    const count = this.timeline.steps.length;
    const cursor = clamp(Math.floor(playhead.cursor), 0, count);
    const until = cursor < count ? this.dateOf(cursor) : this.range.end;
    if (cursor < count && playhead.progress > 0) return { cursor, time: until, progress: Math.min(playhead.progress, 1) };
    return { cursor, time: clamp(playhead.time, cursor === 0 ? this.range.start : this.dateOf(cursor - 1), until), progress: 0 };
  }

  /** Whether the network has a plan built on it: changes after every dated one. */
  private get hasPlan(): boolean {
    return this.timeline.datedCount < this.timeline.steps.length;
  }

  /**
   * The date a change plays on: its own, within the range, or the end of the range for a plan's.
   *
   * @param change - The change's position in the timeline.
   * @returns The date, as a timestamp.
   */
  public dateOf(change: number): number {
    const step = required(this.timeline.steps[change], `step ${change}`);
    return step.planned ? this.range.end : clamp(step.time, this.range.start, this.range.end);
  }

  /**
   * A day's changes, or a plan's.
   *
   * @param day - The day, as a timestamp at its start; `null` for the plan's.
   * @returns The cursor before the first of them, and the one after the last.
   */
  private changesOf(day: number | null): { first: number; last: number } {
    if (day === null) return { first: this.timeline.datedCount, last: this.timeline.steps.length };
    return { first: this.timeline.cursorAt(day - 1), last: this.timeline.cursorAt(day) };
  }

  /**
   * Whether two playheads are the same place, as anyone looking would say: the same changes done, as
   * far through the next, the clock on the same day.
   *
   * @param first - One playhead.
   * @param second - The other.
   * @returns True if they are.
   */
  private samePlace(first: Playhead, second: Playhead): boolean {
    return first.cursor === second.cursor && first.progress === second.progress && Math.floor(first.time / DAY_MS) === Math.floor(second.time / DAY_MS);
  }
}
