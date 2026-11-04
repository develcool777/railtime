import type { Playback } from './playback.types';
import type { RenderState } from '../../src/layers/style.types';
import type { StepAnimation } from '../../src/steps/animation.service';
import type { StepDrawing } from '../../src/steps/animation.types';

/** How a frame is drawn: how far its highlight has faded. */
export type FrameOptions = { holdProgress?: number };

/** A step started on a network, with what it was started on and a way to draw its frames. */
export type StartedStep = {
  playback: Playback;
  animation: StepAnimation;
  /** The render state as the step starts. */
  state: RenderState;
  /** Draws the frame at a progress. */
  draw: (progress: number, options?: FrameOptions) => StepDrawing;
};
