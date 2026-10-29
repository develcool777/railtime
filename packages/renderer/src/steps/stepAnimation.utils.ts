import { emptyCollection } from '../layers/features.utils';
import type { RenderState } from '../layers/lineStyle.types';
import type { Step } from '../model/timeline.types';
import type { ChangeInfo } from '../transitMap.types';
import { CloseStepAnimation } from './closeStep.service';
import { IdentityStepAnimation } from './identityStep.service';
import { InfillStepAnimation } from './infillStep.service';
import { OpenStepAnimation } from './openStep.service';
import { RenameStepAnimation } from './renameStep.service';
import { StationCloseStepAnimation } from './stationCloseStep.service';
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

/**
 * Every step, described as its caption will be when it plays: for a list of changes.
 *
 * @param state - How lines look: the cursor is set to each step's own.
 * @returns One change per step, in timeline order.
 */
export const describeSteps = (state: Omit<RenderState, 'cursor' | 'identityProgress'>): ChangeInfo[] => {
  const { index, timeline } = state;
  return timeline.steps.map(step => {
    const animation = createStepAnimation(step, { index, timeline, stationsBefore: timeline.stationsOnMap(step.index) });
    return { index: step.index, ...animation.describe({ ...state, cursor: step.index, identityProgress: null }) };
  });
};
