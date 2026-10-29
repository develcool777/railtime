import type { LngLat } from '@railtime/schema/network.types';
import { required } from '../core/required.utils';
import type { RenderState } from '../layers/lineStyle.types';
import type { IdentityStep } from '../model/timeline.types';
import type { StepInfo } from '../transitMap.types';
import { IDENTITY_DRAW_SECONDS, IDENTITY_HOLD_SECONDS } from './step.constants';
import { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

/**
 * Lines taking their own identity (one line splitting into several): their track, already on the
 * map, changes colour and separates. The colour blend is drawn by the network layer, which redraws
 * every frame while `changesIdentity` is true; this step adds nothing of its own.
 */
export class IdentityStepAnimation extends StepAnimation<IdentityStep> {
  /** Seconds at 1× for the colour change. */
  public readonly drawSeconds = IDENTITY_DRAW_SECONDS;
  /** Seconds at 1× before the next step. */
  public readonly holdSeconds = IDENTITY_HOLD_SECONDS;

  public constructor(step: IdentityStep, context: StepContext) {
    super(step, context);
  }

  /** Always: this step is a change of identity. */
  public override get changesIdentity(): boolean {
    return true;
  }

  /**
   * Frames every segment of the lines changing.
   *
   * @returns Every point of their track.
   */
  public cameraPoints(): LngLat[] {
    return this.context.index.lineSegments
      .filter(lineSegment => this.step.lines.includes(lineSegment.line))
      .flatMap(lineSegment => lineSegment.segment.coordinates);
  }

  /**
   * The change, in words from the data (the alias's `text`).
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    return {
      kind: 'identity',
      time: this.date,
      title: this.step.text,
      color: state.baseColor(required(this.step.lines[0], 'line of an identity step')),
      stations: [],
    };
  }

  /**
   * Nothing to add: the network layer draws the blend.
   *
   * @param _frame - Unused.
   * @param _drawing - Unused.
   */
  public draw(_frame: StepFrame, _drawing: StepDrawing): void {
    // The colour change is the network layer redrawing with blended colours.
  }
}
