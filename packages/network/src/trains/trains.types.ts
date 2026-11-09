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
  /** How long after one train the next comes along a route, seconds. */
  headwaySeconds: number;
  /** How close a line's routes may bring their trains where they share track, seconds: past that, each runs less often. */
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

/** How trains run along a route: at each time, seconds, as far along it, km, one way; riding between two places, standing where they are the same. */
export type RouteTimetable = {
  run: TrainRun;
  times: number[];
  kms: number[];
  /** How long one way takes, seconds; a loop's, once round. */
  tripSeconds: number;
  /** How long after one train the next comes along this route, seconds. */
  everySeconds: number;
  /** How long after setting out a train sets back from the far end, seconds; 0 on a loop, where each way has trains of its own. */
  backAfterSeconds: number;
  /** How long a train's whole round takes, turns included: a whole number of `everySeconds`, its trains being that many. */
  roundSeconds: number;
  /** How far on the route's clock is, seconds: what times it against the line's other routes. */
  phaseSeconds: number;
};

/** A route's trains where they meet others': when they pass, on the clock, how often, and the service they run in. */
export type Passing = {
  /** When one passes, seconds, within `everySeconds`. */
  clockSeconds: number;
  everySeconds: number;
  /** Which service, among every line's. */
  service: number;
};

/** The beats that would bring a route's trains onto others already placed where they meet, seconds. */
export type TakenBeats = {
  /** Its own line's. */
  own: number[];
  /** Other lines'. */
  others: number[];
};

/** Where a train is at a moment: on which run, how far along it, km, and which way it is heading. */
export type TrainPlace = { run: TrainRun; km: number; heading: Heading };
