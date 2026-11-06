/** How fast a train runs, km a second: far past a real one's, which at the zoom of a city would hardly seem to move. */
export const TRAIN_KM_PER_SECOND = 0.25;

/** How long a train stands at a stop, seconds. */
export const TRAIN_STOP_SECONDS = 1.2;

/** About how many trains a large network runs at once: what its interval is worked out to give, so a map of any size stays as busy. */
export const TRAIN_FLEET = 60;

/** How far apart a line's trains run at the closest, km: a small network's are spaced by this, not by the fleet. */
export const TRAIN_LEAST_SPACING_KM = 8;

/** How finely a route's start is tried against the routes it shares track with, seconds. */
export const TRAIN_PHASE_STEP_SECONDS = 1;
