import { YEAR_MS } from '../model/date.utils';
import type { Timeline } from '../model/timeline.service';
import type { Step } from '../model/timeline.types';
import { clamp, easeInOut } from './easing.utils';
import { CAMERA_PRE_SECONDS, FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from './player.constants';
import type { ActivePlayback, AnimationFactory, Phase, PlayerEvent } from './player.types';

/**
 * Plays the timeline: the clock runs between dates, stops on a date, and plays that date's steps one
 * by one, each through its phases. Knows nothing of the map: it reports what happened as events.
 */
export class Player {
  /** The clock, as a UTC timestamp. */
  public clock: number;
  /** Steps that have happened. */
  public cursor: number;
  /** Whether the clock and steps advance on `tick`. */
  public playing = false;
  /** Playback speed multiplier. */
  public speed = 1;
  /** Seconds at 1× the camera gets before each step draws. */
  public preSeconds = CAMERA_PRE_SECONDS;
  /** The step playing now, if any. */
  public active: ActivePlayback | null = null;
  /** Today: where the map opens, and past which every change is planned. */
  public readonly today: number;
  /** Where playback ends: today, or the last planned change after it. */
  public readonly end: number;
  /** The steps to play. */
  private readonly timeline: Timeline;
  /** Builds each step's animation as it starts. */
  private readonly createAnimation: AnimationFactory;

  public constructor(timeline: Timeline, today: number, createAnimation: AnimationFactory) {
    this.timeline = timeline;
    this.today = today;
    this.end = Math.max(today, timeline.steps.at(-1)?.time ?? today);
    this.createAnimation = createAnimation;
    this.clock = today;
    this.cursor = timeline.cursorAt(today);
  }

  /** The active step's phase, or `null` between steps. */
  public get phase(): Phase | null {
    const active = this.active;
    if (!active) return null;
    if (active.elapsed < active.preSeconds) return 'pre';
    return active.elapsed < active.preSeconds + active.animation.drawSeconds ? 'draw' : 'hold';
  }

  /** How far the active change has animated, eased: 0 during `pre`, 1 during `hold`. */
  public get progress(): number {
    const active = this.active;
    return active ? easeInOut(clamp((active.elapsed - active.preSeconds) / active.animation.drawSeconds, 0, 1)) : 0;
  }

  /** How far the active step's highlight has faded: 0 → 1 over `hold`. */
  public get holdProgress(): number {
    const active = this.active;
    return active ? clamp((active.elapsed - active.preSeconds - active.animation.drawSeconds) / active.animation.holdSeconds, 0, 1) : 0;
  }

  /**
   * Jumps to the end of a day, with nothing animating.
   *
   * @param time - A timestamp on that day; clamped to the timeline.
   */
  public seek(time: number): void {
    this.clock = clamp(time, this.timeline.start, this.end);
    this.cursor = this.timeline.cursorAt(this.clock);
    this.active = null;
  }

  /**
   * Advances playback.
   *
   * @param seconds - Real seconds since the last tick.
   * @returns What happened.
   */
  public tick(seconds: number): PlayerEvent[] {
    if (!this.playing) return [];
    const events: PlayerEvent[] = [];
    if (this.active) {
      this.active.elapsed += seconds * this.speed;
      const { preSeconds, animation } = this.active;
      if (this.active.elapsed >= preSeconds + animation.drawSeconds + animation.holdSeconds) this.finishStep(events);
      return events;
    }
    this.advanceClock(seconds, events);
    return events;
  }

  /**
   * Finishes the playing step now, or jumps the clock to the next one.
   *
   * @returns What happened.
   */
  public skip(): PlayerEvent[] {
    const events: PlayerEvent[] = [];
    const next = this.timeline.steps[this.cursor];
    if (this.active) this.finishStep(events);
    else if (next) {
      this.clock = next.time;
      this.startStep(next, events);
    }
    return events;
  }

  /**
   * Runs the clock towards the next step, fast through quiet years, and starts it on its date.
   *
   * @param seconds - Real seconds since the last tick.
   * @param events - Filled with what happened.
   */
  private advanceClock(seconds: number, events: PlayerEvent[]): void {
    const next = this.timeline.steps[this.cursor];
    const target = next ? next.time : this.end;
    const yearsPerSecond = (target - this.clock) / YEAR_MS > SLOW_YEARS_PER_SECOND ? FAST_YEARS_PER_SECOND : SLOW_YEARS_PER_SECOND;
    this.clock += yearsPerSecond * this.speed * seconds * YEAR_MS;
    if (next && this.clock >= next.time) {
      this.clock = next.time;
      this.startStep(next, events);
    } else if (!next && this.clock >= this.end) {
      this.clock = this.end;
      this.playing = false;
      events.push({ type: 'end' });
    }
  }

  /**
   * Starts a step.
   *
   * @param step - The step at the cursor.
   * @param events - Filled with what happened.
   */
  private startStep(step: Step, events: PlayerEvent[]): void {
    this.active = { animation: this.createAnimation(step), elapsed: 0, preSeconds: this.preSeconds };
    events.push({ type: 'stepStart', playback: this.active });
  }

  /**
   * Ends the playing step and moves the cursor past it.
   *
   * @param events - Filled with what happened.
   */
  private finishStep(events: PlayerEvent[]): void {
    const { step } = this.active!.animation;
    this.active = null;
    this.cursor = step.index + 1;
    events.push({ type: 'stepEnd', step });
  }
}
