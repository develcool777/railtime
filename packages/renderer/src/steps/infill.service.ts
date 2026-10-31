import type { LngLat } from '@railtime/schema/network.types';
import type { InfillStep } from '@railtime/network/timeline.types';
import { INFILL_DRAW_SECONDS, INFILL_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

/** A station opening on track its lines already run over: it pops in on the line. */
export class InfillStepAnimation extends StepAnimation<InfillStep> {
  /** Seconds at 1× for the station to appear. */
  public readonly drawSeconds = INFILL_DRAW_SECONDS;
  /** Seconds at 1× it stays highlighted. */
  public readonly holdSeconds = INFILL_HOLD_SECONDS;

  public constructor(step: InfillStep, context: StepContext) {
    super(step, context);
  }

  /**
   * Frames the station.
   *
   * @returns Its coordinate.
   */
  public cameraPoints(): LngLat[] {
    return [this.context.index.coordOf(this.step.station)];
  }

  /**
   * Adds the station to its lines and highlights it. Its lines call there once this step has played,
   * so it is asked of the network as it stands after it.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const after = { ...frame, state: { ...frame.state, cursor: this.step.index + 1 } };
    for (const line of this.step.lines) this.reach(after, drawing, this.step.station, line);
    if (drawing.reached.has(this.step.station)) drawing.highlighted.add(this.step.station);
  }
}
