/** How fast a new stretch grows, km per second at 1×. */
export const GROWTH_KM_PER_SECOND = 2.5;

/** Shortest time a stretch takes to draw, seconds at 1×: even a short one is seen. */
export const MIN_DRAW_SECONDS = 1;

/** Longest time a stretch takes to draw, seconds at 1×: a long one speeds up. */
export const MAX_DRAW_SECONDS = 6;

/** Base time new stations stay highlighted after their stretch draws, seconds at 1×. */
export const HOLD_BASE_SECONDS = 0.9;

/** Extra highlight time per new station, so a long list can be read. */
export const HOLD_PER_STATION_SECONDS = 0.15;

/** Longest a stretch's stations stay highlighted, seconds at 1×. */
export const MAX_HOLD_SECONDS = 2.5;

/** Time closing track takes to retract, seconds at 1×. */
export const CLOSE_DRAW_SECONDS = 1.6;

/** Pause after a closure, seconds at 1×. */
export const CLOSE_HOLD_SECONDS = 0.6;

/** Time an infill station takes to appear, seconds at 1×. */
export const INFILL_DRAW_SECONDS = 0.8;

/** Time an infill station stays highlighted, seconds at 1×. */
export const INFILL_HOLD_SECONDS = 1.2;

/** Time a station takes to fade when its lines stop calling, seconds at 1×. */
export const STATION_CLOSE_DRAW_SECONDS = 0.8;

/** Pause after a station closes, seconds at 1×. */
export const STATION_CLOSE_HOLD_SECONDS = 0.8;

/** Time before a renamed station pulses, seconds at 1×. */
export const RENAME_DRAW_SECONDS = 0.4;

/** Time a renamed station stays highlighted, so its new name can be read, seconds at 1×. */
export const RENAME_HOLD_SECONDS = 1.6;

/** Time an identity change's colour blend takes, seconds at 1×. */
export const IDENTITY_DRAW_SECONDS = 2.2;

/** Pause after an identity change, seconds at 1×. */
export const IDENTITY_HOLD_SECONDS = 0.6;
