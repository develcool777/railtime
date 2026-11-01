/** How far a segment's track may end from its station, metres: further, and the line misses the station's dot. */
export const STATION_GAP_METRES = 15;

/**
 * The sharpest a segment's track may turn, degrees: sharper, it doubles back on itself, which no track
 * does; a point a few metres past a station, pulled back to it, looks so.
 */
export const MAX_TURN_DEGREES = 150;
