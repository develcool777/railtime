import type { LngLat } from '@railtime/schema/network.types';
import { required } from '../core/required.utils';
import type { RenderState } from '../layers/lineStyle.types';
import { resolveLine } from '../layers/lineStyle.utils';
import type { StationCloseStep } from '../model/timeline.types';
import type { StepInfo } from '../transitMap.types';
import { STATION_CLOSE_DRAW_SECONDS, STATION_CLOSE_HOLD_SECONDS } from './step.constants';
import { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

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
   * "<station> closes", on which lines.
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    const lines = this.step.lines.map(line => resolveLine(state, line));
    return {
      kind: 'stationClose',
      time: this.date,
      title: `${this.nameOf(this.step.station, this.step.time)} closes`,
      subtitle: `on the ${lines.map(line => this.context.index.lineName(line.id)).join(' and ')}`,
      color: required(lines[0], 'line of a station-close step').color,
      stations: [],
    };
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
