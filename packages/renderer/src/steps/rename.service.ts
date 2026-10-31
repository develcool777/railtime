import type { LngLat } from '@railtime/schema/network.types';
import type { RenameStep } from '@railtime/network/timeline.types';
import { RENAME_DRAW_SECONDS, RENAME_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

/** A station takes a new name: it pulses, labelled with it. */
export class RenameStepAnimation extends StepAnimation<RenameStep> {
  /** Seconds at 1× before the station pulses. */
  public readonly drawSeconds = RENAME_DRAW_SECONDS;
  /** Seconds at 1× it stays highlighted under its new name. */
  public readonly holdSeconds = RENAME_HOLD_SECONDS;

  public constructor(step: RenameStep, context: StepContext) {
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
   * Highlights the station, which the map labels with its name on the step's date: the new one.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    if (frame.snapshot.stations.has(this.step.station)) drawing.highlighted.add(this.step.station);
  }
}
