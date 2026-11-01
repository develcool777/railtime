import type { ViewMode } from '../transitMap.types';
import type { GrowthPace } from './animation.types';

/**
 * How fast a new stretch grows, by how the map is seen: the same for every stretch, however long and
 * however many stations it opens. From above, a city at a glance, it grows briskly; in 3D the camera
 * follows it at street level, where the same pace would cross the screen in a blink.
 */
export const GROWTH_PACE: Record<ViewMode, GrowthPace> = {
  '2d': { kmPerSecond: 2.5, rampSeconds: 0.3, stationSeconds: 0.3 },
  '3d': { kmPerSecond: 0.8, rampSeconds: 0.8, stationSeconds: 0.6 },
};

/** Time a stretch's new stations stay highlighted once it has grown, seconds at 1×. */
export const OPEN_HOLD_SECONDS = 1.2;

/** The shortest any change takes to draw, seconds at 1×: only for one with nothing to draw. */
export const MIN_DRAW_SECONDS = 0.2;

/** Time closing track takes to retract, seconds at 1×. */
export const CLOSE_DRAW_SECONDS = 1.6;

/** Pause after a closure, its stations' names still up, marked closed, seconds at 1×. */
export const CLOSE_HOLD_SECONDS = 1.4;

/** Time an infill station takes to appear, seconds at 1×. */
export const INFILL_DRAW_SECONDS = 0.8;

/** Time an infill station stays highlighted, seconds at 1×. */
export const INFILL_HOLD_SECONDS = 1.2;

/** Time a station takes to fade when its lines stop calling, seconds at 1×. */
export const STATION_CLOSE_DRAW_SECONDS = 1;

/** Pause after a station closes, its name still up, marked closed, seconds at 1×. */
export const STATION_CLOSE_HOLD_SECONDS = 1.6;

/** Time before a renamed station pulses, seconds at 1×. */
export const RENAME_DRAW_SECONDS = 0.5;

/** Time a renamed station stays labelled with its new name over its old, so both can be read, seconds at 1×. */
export const RENAME_HOLD_SECONDS = 2.4;

/** Time an identity change's colour blend takes, seconds at 1×. */
export const IDENTITY_DRAW_SECONDS = 2.2;

/** Pause after an identity change, seconds at 1×. */
export const IDENTITY_HOLD_SECONDS = 0.6;

/**
 * Following a growing line, the camera sits on its middle over this far either side of the front,
 * km: a sharp bend is rounded, never turned on the spot.
 */
export const CHASE_SMOOTHING_KM = 0.12;

/** Following a growing line, the camera faces from this far behind the front, km. */
export const CHASE_BEHIND_KM = 0.15;

/** Following a growing line, the camera faces to this far ahead of the front, km: it turns before a bend, not in it. */
export const CHASE_AHEAD_KM = 0.35;
