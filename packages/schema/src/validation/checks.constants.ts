import type { Mode } from '../format/network.types';

/** How far a segment's track may end from its station, metres: further, and the line misses the station's dot. */
export const STATION_GAP_METRES = 15;

/**
 * The sharpest a track may turn at all, degrees: sharper, it doubles back on itself, which no track
 * does; a point a few metres past a station, pulled back to it, looks so.
 */
export const MAX_TURN_DEGREES = 150;

/**
 * How far either side of a point its turn is measured, metres: over that, a turn is the curve a train
 * takes, not the kink between two points a few metres apart.
 */
export const CURVE_SPAN_METRES = 40;

/**
 * The tightest curve each mode's trains take, metres of radius: a tram turns at a street corner, a
 * metro's tightest tunnels curve at about 60 m, a main line wider still.
 */
export const MIN_CURVE_RADIUS_METRES: Record<Mode, number> = {
  metro: 50,
  'light-metro': 40,
  'suburban-rail': 50,
  rail: 50,
  tram: 15,
  cable: 15,
};
