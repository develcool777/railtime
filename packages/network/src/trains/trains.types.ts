import type { LineId, Mode, StationId } from '@railtime/schema/network.types';
import type { TrackSegment } from '../engine/engine.types';

/** How a kind of railway runs, in real units: what a timetable is worked out from. */
export type TrainProfile = {
  /** The speed it holds between stops, once it reaches it, km/h. */
  topKmh: number;
  /** How fast it gains speed, and loses it: the same, so a trip back is a trip out run backwards. */
  rateMetresPerSecondSquared: number;
  /** How long it stands at a stop, seconds. */
  standSeconds: number;
  /** The least time from reaching an end to leaving it again, seconds: its passengers off and on, its driver to the other cab. */
  turnSeconds: number;
  /** How long after one train the next comes along a route, seconds, where its track has room. */
  headwaySeconds: number;
  /**
   * How close trains may come on one track, any line's, seconds, as signals keep them: where the routes
   * on a track would bring theirs closer, each runs less often.
   */
  closestSeconds: number;
};

/** Which way along a run a train heads: out from its first end, or back to it. */
export type Heading = 1 | -1;

/** A stretch of a train's run: a segment, which way along it, and how far along the run it starts, km. */
export type TrainLeg = { segment: TrackSegment; forward: boolean; startKm: number };

/** Track a train runs along at a moment: a way along a line from one end to another, a loop's ends the same station. */
export type TrainRun = {
  line: LineId;
  /** What kind of railway it is. */
  mode: Mode;
  /** The stations it runs between. */
  ends: [StationId, StationId];
  legs: TrainLeg[];
  lengthKm: number;
  /** How far along the run each stop is, km, in order. */
  stopsKm: number[];
  /** A loop's trains go only out along it, for a line that is one direction of a circle; left out, it runs both ways. */
  oneWay?: true;
};

/**
 * How a route's trains ride it one way, out from its first end: at each time after setting out,
 * seconds, as far along it, km; riding between two places, standing where they are the same. The way
 * back is the way out run backwards.
 */
export type Ride = {
  run: TrainRun;
  times: number[];
  kms: number[];
  /** How long it takes, end to end; a loop's, once round. */
  seconds: number;
};

/**
 * A place a route's trains meet others, one way: entering a stretch of one track (any line's on it), or
 * coming to its line's platforms at an end; how long after setting out they reach it, and how far
 * behind another train they may.
 */
export type Meeting = { place: string; seconds: number; separation: number };

/** A train placed through a place: when, seconds into the cycle, and how far behind it another may come. */
export type Passing = { seconds: number; separation: number };

/** A time a train placed would come too close to others: from how far either side of it it is clear, seconds. */
export type Conflict = { center: number; reach: number };

/** How many trains a cycle a place has room for, and the routes on it, by their place among the routes. */
export type TrackRoom = { room: number; routes: number[] };

/** The place a route's trains share with the most others, and how many trains a cycle pass it. */
export type Bottleneck = { place: string; trains: number };

/** A train coming in to an end: when, seconds into the cycle, on which route (its place among the routes), and as what it stands there. */
export type Arrival = { seconds: number; route: number; km: number; heading: Heading };

/** An end of a line where trains turn: those coming in, when those setting out do, seconds into the cycle, and how long after coming in one is ready. */
export type TrainEnd = { arrivals: Arrival[]; departures: number[]; readySeconds: number };

/** A train standing at an end between trips: when it comes in, seconds into the cycle, how long it stands, and as what it is drawn. */
export type Layover = { fromSeconds: number; seconds: number; km: number; heading: Heading };

/** When a route's trains set out each way, seconds into the cycle: out from its first end, and back; none back on a loop run one way. */
export type Departures = { out: number[]; back: number[] };

/** How a route is run through the cycle: its ride, when its trains set out, and how they turn at its ends. */
export type RouteSchedule = {
  run: TrainRun;
  ride: Ride;
  departures: Departures;
  /** Every train standing at an end it came in to on this route, until it sets out again, on whichever of its line's routes. */
  layovers: Layover[];
};

/** Where a train is at a moment: on which run, how far along it, km, and which way it is heading. */
export type TrainPlace = { run: TrainRun; km: number; heading: Heading };
