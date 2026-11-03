import type { NetworkEngine } from '@railtime/network/engine.service';
import { YEAR_MS } from '@railtime/core/date.utils';
import type { Step } from '@railtime/network/engine.types';
import { clamp } from '@railtime/core/number.utils';
import { CAMERA_PRE_SECONDS, FAST_YEARS_PER_SECOND, SLOW_YEARS_PER_SECOND } from './player.constants';
import type { Playhead } from '@railtime/network/facts.types';
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
  /** The step playing now, if any. */
  private current: ActivePlayback | null = null;
  /** Today: where the map opens. */
  public readonly today: number;
  /** Where the clock ends: today, or a dated step after it. Planned steps play here. */
  public readonly end: number;
  /** The steps to play. */
  private readonly timeline: NetworkEngine['timeline'];
  /** Where in the history it can be, and the dates its changes play on. */
  private readonly playheads: NetworkEngine['playheads'];
  /** Builds each step's animation as it starts. */
  private readonly createAnimation: AnimationFactory;

  public constructor(engine: Pick<NetworkEngine, 'timeline' | 'range' | 'playheads'>, createAnimation: AnimationFactory) {
    const { timeline, range, playheads } = engine;
    this.timeline = timeline;
    this.playheads = playheads;
    this.today = range.today;
    this.end = range.end;
    this.createAnimation = createAnimation;
    const opening = playheads.today();
    this.time = opening.time;
    this.stepsDone = opening.cursor;
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

  /** Where it is: the changes done, the clock, and how far the next change has been drawn. */
  public get playhead(): Playhead {
    return { cursor: this.stepsDone, time: this.time, progress: this.progress };
  }

  /**
   * Whether the map shows a plan: its playhead in one (`Playheads.inPlan`), or the camera on its way to
   * a planned change about to draw, which no playhead tells.
   */
  public get inPlan(): boolean {
    return this.playheads.inPlan(this.playhead) || this.current?.animation.step.planned === true;
  }

  /** The active step's phase, or `null` between steps. */
  public get phase(): Phase | null {
    const active = this.current;
    if (!active) return null;
    if (active.elapsed < active.preSeconds) return 'pre';
    return active.elapsed < active.preSeconds + active.animation.drawSeconds ? 'draw' : 'hold';
  }

  /** How far through its drawing time the active change is, linear: 0 during `pre`, 1 during `hold`. Each kind of step eases it as it draws. */
  public get progress(): number {
    const active = this.current;
    return active ? clamp((active.elapsed - active.preSeconds) / active.animation.drawSeconds, 0, 1) : 0;
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
   * Sets how long the step playing waits before it draws, once the camera has said how long its move takes.
   *
   * @param seconds - The wait, at 1×.
   */
  public retimeLeadIn(seconds: number): void {
    if (this.current) this.current.preSeconds = seconds;
  }

  /**
   * Builds the change playing again, as the map is now seen (another view draws it at another pace), as
   * far through each phase as it was: the playhead stays where it is.
   */
  public rebuild(): void {
    const active = this.current;
    if (!active) return;
    const [phase, fraction] = [this.phase ?? 'pre', this.phaseProgress];
    const animation = this.createAnimation(active.animation.step);
    this.current = { ...active, animation, elapsed: this.elapsedAt(animation, active.preSeconds, phase, fraction) };
  }

  /**
   * Plays: on from here, or from a playhead. At the end, where everything has played, it starts again:
   * from history's first date or, for a network with a plan, from today, where the plan starts.
   *
   * @param from - Where from: here, unless given.
   */
  public play(from?: Playhead): void {
    if (from) this.seek(from);
    else if (this.stepsDone >= this.timeline.steps.length && this.time >= this.end) this.seek(this.playheads.start());
    this.running = true;
  }

  /** Pauses where it is. */
  public pause(): void {
    this.running = false;
  }

  /**
   * Moves to a playhead, as a video player's seek does: playing, it plays on from there; paused, it
   * stays paused (at the end, where everything has played, playing ends on the next frame). The cursor
   * is held to the timeline and the clock to its change's years: from the last change done's date
   * (history's start for none) to the next one's (the end for a plan's). A change drawn in part stands
   * on its date, drawn so far, as playing left it.
   *
   * @param to - Where to.
   */
  public seek(to: Playhead): void {
    const { cursor, time, progress } = this.playheads.hold(to);
    this.stepsDone = cursor;
    this.time = time;
    this.current = null;
    const next = this.timeline.steps[cursor];
    if (!next || progress === 0) return;
    const animation = this.createAnimation(next);
    // Past the camera's beat, as far through drawing as it was: a step drawn whole holds.
    this.current = { animation, elapsed: this.elapsedAt(animation, CAMERA_PRE_SECONDS, 'draw', progress), preSeconds: CAMERA_PRE_SECONDS };
  }

  /**
   * A year back or on, within the timeline.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    this.seek(this.playheads.on(this.time + direction * YEAR_MS));
  }

  /** To just before the change before the one playing (or last played): it plays again if playing. */
  public previousChange(): void {
    const current = this.current?.animation.step.index ?? this.stepsDone - 1;
    this.seek(this.playheads.before(Math.max(current - 1, 0)));
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
      this.time = this.playheads.dateOf(next.index);
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
    const target = next ? this.playheads.dateOf(next.index) : this.end;
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

  /** How far through its phase the change playing is, 0 to 1: the camera's beat, drawing, or held. */
  private get phaseProgress(): number {
    const active = this.current;
    if (!active) return 0;
    if (this.phase === 'pre') return active.preSeconds > 0 ? active.elapsed / active.preSeconds : 0;
    return this.phase === 'draw' ? this.progress : this.holdProgress;
  }

  /**
   * Seconds into a change, at 1×, at a point in one of its phases.
   *
   * @param animation - The change's animation: how long it draws and is held.
   * @param preSeconds - The camera's beat before it draws.
   * @param phase - The phase.
   * @param fraction - How far through that phase, 0 to 1.
   * @returns The seconds.
   */
  private elapsedAt(animation: ActivePlayback['animation'], preSeconds: number, phase: Phase, fraction: number): number {
    if (phase === 'pre') return fraction * preSeconds;
    if (phase === 'draw') return preSeconds + fraction * animation.drawSeconds;
    return preSeconds + animation.drawSeconds + fraction * animation.holdSeconds;
  }

  /**
   * Starts a step.
   *
   * @param step - The step at the cursor.
   * @param events - Filled with what happened.
   */
  private startStep(step: Step, events: PlayerEvent[]): void {
    this.current = { animation: this.createAnimation(step), elapsed: 0, preSeconds: CAMERA_PRE_SECONDS };
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
