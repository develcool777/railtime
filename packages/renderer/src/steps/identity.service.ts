import type { LngLat } from '@railtime/schema/network.types';
import type { IdentityStep } from '@railtime/network/engine/timeline.types';
import { IDENTITY_DRAW_SECONDS, IDENTITY_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

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
   * Nothing to add: the network layer draws the blend.
   *
   * @param _frame - Unused.
   * @param _drawing - Unused.
   */
  public draw(_frame: StepFrame, _drawing: StepDrawing): void {
    // The colour change is the network layer redrawing with blended colours.
  }
}
