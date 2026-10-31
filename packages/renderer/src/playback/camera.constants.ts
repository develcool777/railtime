/** Closest zoom when following one change. */
export const FOLLOW_MAX_ZOOM = 13.5;

/** Closest zoom when framing the network around a change. */
export const OVERVIEW_MAX_ZOOM = 12.5;

/** The camera stays where it is when what a change touches is in view and its zoom is within this of the framing's. */
export const ZOOM_SLACK = 1;

/** Following a lone station, the camera keeps its zoom between this and `FOLLOW_MAX_ZOOM`: it pans, not dives. */
export const STATION_MIN_ZOOM = 12;

/** Shortest a camera move takes, ms, whatever the speed: quicker is a jolt. */
export const MIN_MOVE_MS = 700;
