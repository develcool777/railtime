/** What a route is best at: arriving soonest, or changing least, if it takes a little longer. */
export type RoutePreference = 'fastest' | 'fewer-changes';

/** A stretch of a route on one line, from where it is boarded to where it is left. */
export type RideLeg = {
  kind: 'ride';
  line: string;
  /** Its stops, from the one boarded at to the one left at. */
  stops: string[];
  /** The track it rides, by `TrackSegment.index`. */
  segments: number[];
  km: number;
  minutes: number;
};

/** A walk between two stations a transfer links. */
type WalkLeg = { kind: 'walk'; from: string; to: string; minutes: number };

/** One part of a route. */
export type RouteLeg = RideLeg | WalkLeg;

/** How to get from one station to another on the network of a date: its legs, and what it takes. */
export type Route = {
  legs: RouteLeg[];
  /** About how long it takes, changes and walks included. */
  minutes: number;
  /** How far it rides. */
  km: number;
  /** How many times it changes line, on foot or not. */
  changes: number;
};

/** Being at a station on a line: a node of the route graph, `<station>|<line>`. */
export type Place = string;

/** How a place is reached: by riding a segment of track, changing line at a station, or walking a transfer. */
export type Move = { kind: 'ride'; segment: number; km: number } | { kind: 'change' } | { kind: 'walk' };

/** An edge of the route graph: where it leads, what it costs, and what it is. */
export type Edge = { to: Place; minutes: number; move: Move };
