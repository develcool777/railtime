import type { LngLat } from '@railtime/schema/network.types';
import type { RenderState } from '../layers/lineStyle.types';
import { DAY_MS } from '../model/date.utils';
import type { RenameStep } from '../model/timeline.types';
import type { StepInfo } from '../transitMap.types';
import { RENAME_DRAW_SECONDS, RENAME_HOLD_SECONDS } from './step.constants';
import { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

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
   * "<former name> renamed", to what.
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    const [first] = this.context.index.lineSegmentsAt(this.step.station);
    return {
      kind: 'rename',
      time: this.step.time,
      title: `${this.nameOf(this.step.station, this.step.time - DAY_MS)} renamed`,
      subtitle: `now ${this.nameOf(this.step.station)}`,
      color: first ? state.baseColor(first.line) : '#ffffff',
      stations: [this.nameOf(this.step.station)],
    };
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
