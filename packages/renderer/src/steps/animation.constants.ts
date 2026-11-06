import type { Step } from '@railtime/network/engine.types';
import type { ViewMode } from '../transitMap.types';
import type { BaseNetwork, GrowthPace, StepTimes } from './animation.types';

/**
 * How fast a stretch grows, or a closed one retracts, by how the map is seen: the same for every
 * stretch, however long and however many stations it opens or closes. From above, a city at a glance, it grows briskly; in 3D the camera
 * follows it at street level, where the same pace would cross the screen in a blink.
 */
export const GROWTH_PACE: Record<ViewMode, GrowthPace> = {
  '2d': { kmPerSecond: 2.5, rampSeconds: 0.3, stationSeconds: 0.3 },
  '3d': { kmPerSecond: 0.8, rampSeconds: 0.8, stationSeconds: 0.6 },
};

/** The network with no step asking anything of it, between changes or from a change that leaves it be. */
export const UNTOUCHED_BASE: BaseNetwork = { leavesOut: new Set(), makesRoom: new Set(), blend: null };

/** Time a stretch's new stations stay highlighted once it has grown, seconds at 1×. */
export const OPEN_HOLD_SECONDS = 1.2;

/** Time a closed stretch is held once it has retracted, its stations' names still up, marked closed, seconds at 1×. */
export const CLOSE_HOLD_SECONDS = 1.4;

/** The shortest any change takes to draw, seconds at 1×: only for one with nothing to draw. */
export const MIN_DRAW_SECONDS = 0.2;

/**
 * How long each kind of change but a stretch opening or closing takes, seconds at 1×: to draw, then
 * held. A stretch's time is its length and stations' (`GROWTH_PACE`).
 */
export const STEP_TIMES: Record<Exclude<Step['kind'], 'open' | 'close'>, StepTimes> = {
  // A station appears on a line already running through it.
  infill: { drawSeconds: 0.8, holdSeconds: 1.2 },
  // A station fades as its lines stop calling; then held, its name still up, marked closed.
  stationClose: { drawSeconds: 1, holdSeconds: 1.6 },
  // A beat before the station pulses; then held, its new name over its old, so both can be read.
  rename: { drawSeconds: 0.5, holdSeconds: 2.4 },
  // Lines' colours blend into their own.
  identity: { drawSeconds: 2.2, holdSeconds: 0.6 },
};

/**
 * Following a growing line, the camera sits on its middle over this far either side of the front,
 * km: a sharp bend is rounded, never turned on the spot.
 */
export const CHASE_SMOOTHING_KM = 0.12;

/** Following a growing line, the camera faces from this far behind the front, km. */
export const CHASE_BEHIND_KM = 0.15;

/** Following a growing line, the camera faces to this far ahead of the front, km: it turns before a bend, not in it. */
export const CHASE_AHEAD_KM = 0.35;
