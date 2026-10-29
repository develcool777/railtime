import type { LngLat } from '@railtime/schema/network.types';
import type { RenderState } from '../layers/lineStyle.types';
import { resolveLine } from '../layers/lineStyle.utils';
import type { Step } from '../model/timeline.types';
import type { StepInfo } from '../transitMap.types';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

/**
 * How one kind of step plays: how long it takes, what the camera frames, how it is described, and
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
   * The step for a caption.
   *
   * @param state - The render state when the step starts.
   * @returns Its title, subtitle, colour and stations.
   */
  public abstract describe(state: RenderState): StepInfo;

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
    if (!state.visibleLines.has(line) || state.timeline.isInfillPending(station, line, state.cursor)) return;
    const resolved = resolveLine(state, line);
    const served = drawing.reached.get(station) ?? new Map();
    served.set(resolved.id, resolved.color);
    drawing.reached.set(station, served);
  }

  /**
   * A station's name.
   *
   * @param station - The station id.
   * @returns Its display name.
   */
  protected nameOf(station: string): string {
    return this.context.index.stationName(station);
  }
}
