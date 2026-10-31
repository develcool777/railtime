import { emptyCollection } from '../layers/features.utils';
import type { Step } from '@railtime/network/engine.types';
import { CloseStepAnimation } from './close.service';
import { IdentityStepAnimation } from './identity.service';
import { InfillStepAnimation } from './infill.service';
import { OpenStepAnimation } from './open.service';
import { RenameStepAnimation } from './rename.service';
import { StationCloseStepAnimation } from './stationClose.service';
import type { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing } from './animation.types';

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
    case 'stationClose':
      return new StationCloseStepAnimation(step, context);
    case 'rename':
      return new RenameStepAnimation(step, context);
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
