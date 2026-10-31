/** Years per second while nothing happens for a while. */
export const FAST_YEARS_PER_SECOND = 4;

/** Years per second at the slowest, the last stretch before a change; the clock eases down to it from the fast speed. */
export const SLOW_YEARS_PER_SECOND = 1.2;

/** Seconds at 1× the camera gets to move before each change. */
export const CAMERA_PRE_SECONDS = 1;

/** Seconds at 1× before each change when the camera is free: just a beat. */
export const FREE_CAMERA_PRE_SECONDS = 0.15;
