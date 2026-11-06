import type { LineId, StationId } from '@railtime/schema/network.types';
import type { LineHop } from '../engine/lineDetails.types';

/** A stretch of a route on one line, as the map draws it, from where it is boarded to where it is left. */
export type RideLeg = {
  kind: 'ride';
  line: LineId;
  /** Its stops, from the one boarded at to the one left at. */
  stops: StationId[];
  /** The track it rides, by `TrackSegment.index`. */
  segments: number[];
  km: number;
  minutes: number;
};

/** A walk between two stations a transfer links. */
type WalkLeg = { kind: 'walk'; from: StationId; to: StationId; minutes: number };

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

/**
 * Being at a stop on a line, as the map draws it, so lines drawn as one are one line to ride: a node of
 * the route graph, one object for each, so a map keys by it (`RouteFinder.placeOf`).
 */
export type Place = { readonly station: StationId; readonly line: LineId };

/** A ride from a stop to the next, timed as its line's trains run it: a train's stand at the first, and its run to the next. */
export type TimedHop = LineHop & { minutes: number };

/** The rides from each stop of each line, as the map draws them, at a cursor: the route graph's track. */
export type Rides = Map<LineId, Map<StationId, TimedHop[]>>;

/** How a place is reached: by riding on to the next stop, changing line at a station, or walking a transfer. */
export type Move = { kind: 'ride'; hop: TimedHop } | { kind: 'change' } | { kind: 'walk' };

/** An edge of the route graph: where it leads, what it costs, and what it is. */
export type Edge = { to: Place; minutes: number; move: Move };

/**
 * What one search is of: the network at a cursor and its rides, what a change counts for on top of its
 * minutes, and how many times its minutes a ride over a segment costs, by `TrackSegment.index` (once,
 * without one).
 */
export type SearchTerms = { cursor: number; rides: Rides; penalty: number; weights: ReadonlyMap<number, number> };

/** How a place was reached: the place before it, and the move from there. */
export type Arrival = { from: Place; move: Move };
