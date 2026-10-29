import { emptyCollection } from '../layers/features.utils';
import type { Step } from '../model/timeline.types';
import { CloseStepAnimation } from './closeStep.service';
import { IdentityStepAnimation } from './identityStep.service';
import { InfillStepAnimation } from './infillStep.service';
import { OpenStepAnimation } from './openStep.service';
import type { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing } from './stepAnimation.types';

/**
 * The animation for a step: the one place that maps a kind of step to its class.
 *
 * @param step - The step.
 * @param context - The network as it stands when the step starts.
 * @returns Its animation.
 */
export const createStepAnimation = (step: Step, context: StepContext): StepAnimation => {
  switch (step.kind) {
    case 'open':
      return new OpenStepAnimation(step, context);
    case 'close':
      return new CloseStepAnimation(step, context);
    case 'infill':
      return new InfillStepAnimation(step, context);
    case 'identity':
      return new IdentityStepAnimation(step, context);
  }
};

/**
 * A drawing with nothing in it, for a frame to fill.
 *
 * @returns An empty step drawing.
 */
export const emptyDrawing = (): StepDrawing => ({
  lines: emptyCollection(),
  heads: emptyCollection(),
  reached: new Map(),
  highlighted: new Set(),
  fading: new Map(),
});
