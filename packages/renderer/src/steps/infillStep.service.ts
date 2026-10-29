import type { LngLat } from '@railtime/schema/network.types';
import { required } from '../core/required.utils';
import type { RenderState } from '../layers/lineStyle.types';
import { resolveLine } from '../layers/lineStyle.utils';
import type { InfillStep } from '../model/timeline.types';
import type { StepInfo } from '../transitMap.types';
import { INFILL_DRAW_SECONDS, INFILL_HOLD_SECONDS } from './step.constants';
import { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

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
   * "<station> opens", on which lines.
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    const lines = this.step.lines.map(line => resolveLine(state, line));
    return {
      kind: 'infill',
      time: this.step.time,
      title: `${this.nameOf(this.step.station)} opens`,
      subtitle: `on the ${lines.map(line => this.context.index.lineName(line.id)).join(' and ')}`,
      color: required(lines[0], 'line of an infill step').color,
      stations: [this.nameOf(this.step.station)],
    };
  }

  /**
   * Adds the station to its lines and highlights it.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    for (const line of this.step.lines) this.reach(frame, drawing, this.step.station, line);
    if (drawing.reached.has(this.step.station)) drawing.highlighted.add(this.step.station);
  }
}
