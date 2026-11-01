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

/** In 3D, how far the camera tilts, degrees: low enough to see the buildings stand, high enough to see the streets. */
export const VIEW_3D_PITCH = 60;

/** In 3D, the camera's turn when it is seen in 3D but nothing turns it, degrees: the buildings a little from the side. */
export const VIEW_3D_BEARING = -20;

/** Turning the map to 3D, the camera comes down to at least this zoom: where the buildings stand. */
export const VIEW_3D_ENTRY_ZOOM = 15;

/** How long the camera takes to tilt into 3D or back to the flat map, ms. */
export const VIEW_TILT_MS = 1200;

/**
 * Following a line in 3D, how close the camera is: one zoom for every stretch, long or short, so the
 * streets pass at the line's pace alike; street level, where the buildings stand.
 */
export const CHASE_ZOOM = 15.5;

/**
 * In 3D, the farthest the camera glides to where a change starts, km: about what street level shows.
 * Farther, it jumps there: gliding across the city at street level draws every street on the way, and
 * the map and its minimap stutter through it.
 */
export const CHASE_GLIDE_KM = 3;

/** Following a line in 3D, how quickly the camera turns to face the way the tip moves. */
export const TURN_RATE = 1.5;

/** Following a line in 3D, the least the tip must move, km, before the camera turns with it: a still tip gives no direction. */
export const MIN_TURN_KM = 0.005;
