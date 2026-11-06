import type { Step } from '@railtime/network/engine.types';
import type { StepAnimation } from '../steps/animation.service';
import type { MapProps } from '../transitMap.types';

/** What the player reads from the map's props. */
export type PlayerSettings = Pick<MapProps, 'speed'>;

/** The step playing now. */
export type ActivePlayback = {
  animation: StepAnimation;
  /** Seconds into the step, at 1×. */
  elapsed: number;
  /** Seconds at 1× the camera gets before the change draws. */
  preSeconds: number;
};

/** What happened during a tick. */
export type PlayerEvent = { type: 'stepStart'; playback: ActivePlayback } | { type: 'stepEnd'; step: Step } | { type: 'end' };

/** Builds the animation for a step as the network stands at its cursor. */
export type AnimationFactory = (step: Step) => StepAnimation;
