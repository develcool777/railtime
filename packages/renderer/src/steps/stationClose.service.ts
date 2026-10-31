import type { LngLat } from '@railtime/core/geometry.types';
import type { StationCloseStep } from '@railtime/network/engine.types';
import { STATION_CLOSE_DRAW_SECONDS, STATION_CLOSE_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

/**
 * Lines stop calling at a station they still run through: the track stays, and
 * the dot fades out unless another line still calls there.
 */
export class StationCloseStepAnimation extends StepAnimation<StationCloseStep> {
  /** Seconds at 1× for the station to fade. */
  public readonly drawSeconds = STATION_CLOSE_DRAW_SECONDS;
  /** Seconds at 1× before the next step. */
  public readonly holdSeconds = STATION_CLOSE_HOLD_SECONDS;

  public constructor(step: StationCloseStep, context: StepContext) {
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
   * Fades the station out where no other line still calls there.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const { station } = this.step;
    const { state } = frame;
    // By the lines themselves, not as drawn: a line drawn as a closing one may still call here.
    const staysServed = this.context.index
      .lineSegmentsAt(station)
      .some(
        lineSegment =>
          !this.step.lines.includes(lineSegment.line) &&
          state.visibleLines.has(lineSegment.line) &&
          state.timeline.isOpen(lineSegment, state.cursor) &&
          state.timeline.servesStation(station, lineSegment.line, state.cursor),
      );
    if (frame.snapshot.stations.has(station) && !staysServed) drawing.fading.set(station, 1 - frame.progress);
  }
}
