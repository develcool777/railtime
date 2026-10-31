import type { RenderState } from '../../src/layers/lineStyle.types';
import type { StepAnimation } from '../../src/steps/animation.service';
import type { StepDrawing } from '../../src/steps/animation.types';
import type { Playback } from './playback.types';

/** How a frame is drawn: how far its highlight has faded, and the lines hidden. */
export type FrameOptions = { holdProgress?: number; hidden?: string[] };

/** A step started on a network, with what it was started on and a way to draw its frames. */
export type StartedStep = {
  playback: Playback;
  animation: StepAnimation;
  /** The render state as the step starts, every line shown. */
  state: RenderState;
  /** Draws the frame at a progress. */
  draw: (progress: number, options?: FrameOptions) => StepDrawing;
};
