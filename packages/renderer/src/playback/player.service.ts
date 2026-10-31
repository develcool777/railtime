import { YEAR_MS } from '../core/date.utils';
import type { NetworkModel } from '../model/network.service';
import type { Timeline } from '../network/timeline.service';
import type { Step } from '../network/timeline.types';
import { clamp, easeInOut } from '../core/easing.utils';
import { CAMERA_PRE_SECONDS, FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from './player.constants';
import type { PlayFrom, SeekTarget } from '../transitMap.types';
import type { ActivePlayback, AnimationFactory, Phase, PlayerEvent } from './player.types';

/**
 * Plays the timeline: the clock runs between dates, stops on a date, and plays that date's steps one
 * by one, each through its phases. Planned steps have no date: once the clock reaches the end, they
 * play one after another while it stands there. Knows nothing of the map: it moves by its commands
 * and `tick`, and reports what happened as events. Its state is read through getters, changed only
 * by its commands.
 */
export class Player {
  /** The clock, as a UTC timestamp. */
  private time: number;
  /** Steps that have happened. */
  private stepsDone: number;
  /** Whether the clock and steps advance on `tick`. */
  private running = false;
  /** Playback speed multiplier. */
  private rate = 1;
  /** Seconds at 1× the camera gets before each step draws. */
  private leadIn = CAMERA_PRE_SECONDS;
  /** The step playing now, if any. */
  private current: ActivePlayback | null = null;
  /** Today: where the map opens. */
  public readonly today: number;
  /** Where the clock ends: today, or a dated step after it. Planned steps play here. */
  public readonly end: number;
  /** The steps to play. */
  private readonly timeline: Timeline;
  /** Builds each step's animation as it starts. */
  private readonly createAnimation: AnimationFactory;

  public constructor(model: Pick<NetworkModel, 'timeline' | 'range'>, createAnimation: AnimationFactory) {
    const { timeline, range } = model;
    const today = range.today;
    this.timeline = timeline;
    this.today = today;
    this.end = range.end;
    this.createAnimation = createAnimation;
    this.time = today;
    this.stepsDone = timeline.cursorAt(today);
  }

  /** The clock, as a UTC timestamp. */
  public get clock(): number {
    return this.time;
  }

  /** Steps that have happened. */
  public get cursor(): number {
    return this.stepsDone;
  }

  /** Whether the clock and steps advance on `tick`. */
  public get playing(): boolean {
    return this.running;
  }

  /** Playback speed multiplier. */
  public get speed(): number {
    return this.rate;
  }

  /** The step playing now, if any: read only. */
  public get active(): Readonly<ActivePlayback> | null {
    return this.current;
  }

  /** Whether the map shows a plan's future: a planned step is playing or has played. */
  public get inFuture(): boolean {
    return this.stepsDone > this.timeline.datedCount || this.current?.animation.step.planned === true;
  }

  /** The active step's phase, or `null` between steps. */
  public get phase(): Phase | null {
    const active = this.current;
    if (!active) return null;
    if (active.elapsed < active.preSeconds) return 'pre';
    return active.elapsed < active.preSeconds + active.animation.drawSeconds ? 'draw' : 'hold';
  }

  /** How far the active change has animated, eased: 0 during `pre`, 1 during `hold`. */
  public get progress(): number {
    const active = this.current;
    return active ? easeInOut(clamp((active.elapsed - active.preSeconds) / active.animation.drawSeconds, 0, 1)) : 0;
  }

  /** How far the active step's highlight has faded: 0 → 1 over `hold`. */
  public get holdProgress(): number {
    const active = this.current;
    return active ? clamp((active.elapsed - active.preSeconds - active.animation.drawSeconds) / active.animation.holdSeconds, 0, 1) : 0;
  }

  /**
   * Sets the playback speed.
   *
   * @param speed - A multiplier: 1 is normal.
   */
  public setSpeed(speed: number): void {
    this.rate = speed;
  }

  /**
   * Sets how long, at 1×, a step waits before it draws, for the camera to get there: from the next step on.
   *
   * @param seconds - The wait.
   */
  public setLeadIn(seconds: number): void {
    this.leadIn = seconds;
  }

  /**
   * Sets how long the step playing waits before it draws, once the camera has said how long its move takes.
   *
   * @param seconds - The wait, at 1×.
   */
  public retimeLeadIn(seconds: number): void {
    if (this.current) this.current.preSeconds = seconds;
  }

  /**
   * Plays: on from here, from history's start, or from a change.
   *
   * @param from - `here` (the default; from the start again once at the end), `start` (history's
   * first date; for a network with a plan, today, where its future starts), or a change.
   */
  public play(from: PlayFrom = 'here'): void {
    if (from === 'start') this.seekTime(this.timeline.datedCount < this.timeline.steps.length ? this.today : this.timeline.start);
    else if (from !== 'here') this.seekStep(from.change, false);
    else if (this.stepsDone >= this.timeline.steps.length && this.time >= this.end) this.seekTime(this.timeline.start);
    this.running = true;
  }

  /** Pauses where it is. */
  public pause(): void {
    this.running = false;
  }

  /**
   * Moves through time as a video player's seek does: playing, it plays on from there; paused, it
   * stays paused. The future, where everything has played, pauses.
   *
   * @param to - A day, just after a change or just before one, today, or the future.
   */
  public seek(to: SeekTarget): void {
    if (to === 'future') {
      this.running = false;
      this.seekEnd();
    } else if (to === 'today') this.seekTime(this.today);
    else if ('change' in to) this.seekStep(to.change, true);
    else if ('beforeChange' in to) this.seekStep(to.beforeChange, false);
    else this.seekTime(to.time);
  }

  /**
   * A year back or on, within the timeline.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    this.seekTime(this.time + direction * YEAR_MS);
  }

  /** To just before the change before the one playing (or last played): it plays again if playing. */
  public previousChange(): void {
    const current = this.current?.animation.step.index ?? this.stepsDone - 1;
    this.seekStep(Math.max(current - 1, 0), false);
  }

  /**
   * Jumps to the end of a day, with nothing animating.
   *
   * @param time - A timestamp on that day; clamped to the timeline.
   */
  private seekTime(time: number): void {
    this.time = clamp(time, this.timeline.start, this.end);
    this.stepsDone = this.timeline.cursorAt(this.time);
    this.current = null;
  }

  /** Jumps past every step, planned ones too, with nothing animating: the network as it ends. */
  private seekEnd(): void {
    this.time = this.end;
    this.stepsDone = this.timeline.steps.length;
    this.current = null;
  }

  /**
   * Advances playback.
   *
   * @param seconds - Real seconds since the last tick.
   * @returns What happened.
   */
  public tick(seconds: number): PlayerEvent[] {
    if (!this.running) return [];
    const events: PlayerEvent[] = [];
    if (this.current) {
      this.current.elapsed += seconds * this.rate;
      const { preSeconds, animation } = this.current;
      if (this.current.elapsed >= preSeconds + animation.drawSeconds + animation.holdSeconds) this.finishStep(events);
      return events;
    }
    this.advanceClock(seconds, events);
    return events;
  }

  /**
   * Finishes the playing step now, or jumps the clock to the next one: the next change.
   *
   * @returns What happened.
   */
  public skip(): PlayerEvent[] {
    const events: PlayerEvent[] = [];
    const next = this.timeline.steps[this.stepsDone];
    if (this.current) this.finishStep(events);
    else if (next) {
      this.time = next.planned ? this.end : next.time;
      this.startStep(next, events);
    }
    return events;
  }

  /**
   * Runs the clock towards the next step, fast through quiet years and slowing as it nears, and starts it on its date; a
   * planned step starts once the clock reaches the end.
   *
   * @param seconds - Real seconds since the last tick.
   * @param events - Filled with what happened.
   */
  private advanceClock(seconds: number, events: PlayerEvent[]): void {
    const next = this.timeline.steps[this.stepsDone];
    const target = next && !next.planned ? next.time : this.end;
    // As many years a second as are left, between the two speeds: it slows steadily into the date, never with a jolt.
    const yearsPerSecond = clamp((target - this.time) / YEAR_MS, SLOW_YEARS_PER_SECOND, FAST_YEARS_PER_SECOND);
    this.time = Math.min(target, this.time + yearsPerSecond * this.rate * seconds * YEAR_MS);
    if (next && this.time >= target) {
      this.startStep(next, events);
    } else if (!next && this.time >= this.end) {
      this.time = this.end;
      this.running = false;
      events.push({ type: 'end' });
    }
  }

  /**
   * Puts the clock on a step's date, the end for a planned one, and the cursor on it or past it.
   *
   * @param index - The step's position in the timeline; clamped to it.
   * @param past - Whether the cursor goes past the step, or stays on it.
   */
  private seekStep(index: number, past: boolean): void {
    const step = this.timeline.steps[clamp(index, 0, this.timeline.steps.length - 1)];
    if (!step) return;
    this.time = step.planned ? this.end : clamp(step.time, this.timeline.start, this.end);
    this.stepsDone = step.index + (past ? 1 : 0);
    this.current = null;
  }

  /**
   * Starts a step.
   *
   * @param step - The step at the cursor.
   * @param events - Filled with what happened.
   */
  private startStep(step: Step, events: PlayerEvent[]): void {
    this.current = { animation: this.createAnimation(step), elapsed: 0, preSeconds: this.leadIn };
    events.push({ type: 'stepStart', playback: this.current });
  }

  /**
   * Ends the playing step and moves the cursor past it.
   *
   * @param events - Filled with what happened.
   */
  private finishStep(events: PlayerEvent[]): void {
    const { step } = this.current!.animation;
    this.current = null;
    this.stepsDone = step.index + 1;
    events.push({ type: 'stepEnd', step });
  }
}
