import type { LineId, StationId } from '@railtime/schema/network.types';
import type { TrackSegment } from '../engine/engine.types';

/** A stretch of a train's run: a segment, which way along it, and how far along the run it starts, km. */
export type TrainLeg = { segment: TrackSegment; forward: boolean; startKm: number };

/** Track a train runs along at a moment: a way along a line from one end to another, a loop's ends the same station. */
export type TrainRun = {
  line: LineId;
  /** The stations it runs between. */
  ends: [StationId, StationId];
  legs: TrainLeg[];
  lengthKm: number;
  /** How far along the run each stop is, km, in order. */
  stopsKm: number[];
};

/** How trains run along a route: as far along it, km, at each time, seconds, moving evenly between them, one way. */
export type RouteTimetable = {
  run: TrainRun;
  times: number[];
  kms: number[];
  /** How long one way takes, seconds. */
  tripSeconds: number;
  /** How long after one train the next comes along this route, seconds: its share of its line's interval. */
  everySeconds: number;
  /** How long a train takes each way, turning at the end included: a whole number of `everySeconds`, so a train leaves each end together. */
  wayIncludingTurnSeconds: number;
  /** How long a train's whole round takes: there and back. */
  roundSeconds: number;
  /** How far on the route's clock is, seconds: what times it against the line's other routes. */
  phaseSeconds: number;
};

/** Where a train is at a moment: on which run, how far along it, km, and which way it is heading. */
export type TrainPlace = { run: TrainRun; km: number; heading: 1 | -1 };
