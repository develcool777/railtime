import type { LngLat } from '@railtime/schema/network.types';
import { resolveLine } from '../layers/lineStyle.utils';
import type { Step } from '@railtime/network/engine/timeline.types';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

/**
 * How one kind of step plays: how long it takes, what the camera frames, and
 * what it draws each frame. One subclass per kind of step; the player and the map only ever talk
 * to this base class.
 */
export abstract class StepAnimation<Kind extends Step = Step> {
  /** The step being played. */
  public readonly step: Kind;
  /** Seconds at 1× for the change to animate. */
  public abstract readonly drawSeconds: number;
  /** Seconds at 1× the result stays highlighted afterwards. */
  public abstract readonly holdSeconds: number;
  /** The network as it stood when the step started. */
  protected readonly context: StepContext;

  protected constructor(step: Kind, context: StepContext) {
    this.step = step;
    this.context = context;
  }

  /** Whether the step changes what lines are drawn as: the map then redraws every frame while it plays. */
  public get changesIdentity(): boolean {
    return false;
  }

  /**
   * The points the camera should frame.
   *
   * @returns Points around the change.
   */
  public abstract cameraPoints(): LngLat[];

  /**
   * Where the change starts on the map, for a camera that follows it as it is drawn: its first point,
   * unless it grows from somewhere of its own.
   *
   * @returns The point, or `null` for a change with none.
   */
  public startPoint(): LngLat | null {
    return this.cameraPoints()[0] ?? null;
  }

  /**
   * Adds this frame of the step to the drawing.
   *
   * @param frame - The frame.
   * @param drawing - What the step adds to the map; filled in place.
   */
  public abstract draw(frame: StepFrame, drawing: StepDrawing): void;

  /**
   * Marks a station as reached by a line this frame, unless the line is hidden or the station has
   * not opened on it yet.
   *
   * @param frame - The frame.
   * @param drawing - The drawing to mark it in.
   * @param station - The station id.
   * @param line - The line reaching it.
   */
  protected reach(frame: StepFrame, drawing: StepDrawing, station: string, line: string): void {
    const { state } = frame;
    if (!state.visibleLines.has(line) || !state.timeline.servesStation(station, line, state.cursor)) return;
    const resolved = resolveLine(state, line);
    const served = drawing.reached.get(station) ?? new Map();
    served.set(resolved.id, resolved.color);
    drawing.reached.set(station, served);
  }

  /** The step's date for a caption: `null` for a planned step, which has none. */
  protected get date(): number | null {
    return this.step.planned ? null : this.step.time;
  }

  /**
   * A station's name on the step's date.
   *
   * @param station - The station id.
   * @param time - When; the step's own date by default.
   * @returns Its display name then.
   */
  protected nameOf(station: string, time = this.step.time): string {
    return this.context.index.stationName(station, time);
  }
}
