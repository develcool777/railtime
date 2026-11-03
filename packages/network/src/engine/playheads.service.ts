import { clamp } from '@railtime/core/number.utils';
import { required } from '@railtime/core/required.utils';
import { DAY_MS } from '@railtime/core/date.utils';
import type { Playhead } from '../facts/facts.types';
import type { Timeline } from './timeline.service';

/**
 * Where in its history the map can be, as a `Playhead`, and the one place its rules are: the date each
 * change plays on, the years the clock may stand in after one, where playing starts. The player seeks
 * through `hold` and runs its clock to `dateOf`; the app asks for one on a day, after or before a change,
 * today or at the end (`NetworkFacts.playheads`).
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
