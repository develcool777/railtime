/** Minutes to change line at one station. */
export const CHANGE_MINUTES = 4;

/** Minutes to walk between two stations a transfer links, changing line. */
export const WALK_MINUTES = 6;

/** Minutes a change counts for on top, when looking for the route that changes least. */
export const FEWER_CHANGES_PENALTY = 15;

/** The most routes offered between two stations. */
export const ROUTE_OPTIONS = 3;

/**
 * How much more a segment of track costs, each search for another way, for each route found riding it:
 * the next search is pushed off the track the ways found share, onto another where there is one.
 */
export const SEGMENT_PENALTY_FACTOR = 1.6;

/** How many searches for another way, at most: each pushed further off the ways found. */
export const ALTERNATIVE_SEARCHES = 8;

/** The slowest an alternative may be: so many times the fastest route's minutes, and a few more. */
export const ALTERNATIVE_SLOWER = 1.5;

/** Minutes an alternative may take on top of `ALTERNATIVE_SLOWER` times the fastest: room on a short trip. */
export const ALTERNATIVE_EXTRA_MINUTES = 8;
