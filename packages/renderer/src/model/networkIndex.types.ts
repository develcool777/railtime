import type { LngLat } from '@railtime/schema/network.types';

/** Direction of travel along a segment: 1 from station A to B, -1 from B to A. */
export type Travel = 1 | -1;

/** Track between two adjacent stations, with its geometry prepared for drawing part of it in either direction. */
export type TrackSegment = {
  /** Position in the network's segment list: a stable id. */
  index: number;
  stationA: string;
  stationB: string;
  /** From station A to station B. */
  coordinates: LngLat[];
  /** From station B to station A. */
  reversedCoordinates: LngLat[];
  /** Distance along `coordinates` to each point, km. */
  distances: number[];
  /** Distance along `reversedCoordinates` to each point, km. */
  reversedDistances: number[];
  lengthKm: number;
  /** The segment's direction along its route, consistent with its neighbours': see `orientation.utils.ts`. */
  travel: Travel;
};

/** One line running over one segment for one period, with its dates as timestamps. */
export type LineSegment = {
  segment: TrackSegment;
  line: string;
  opens: number;
  closes: number | null;
  /** The line's period here before this one, when it was suspended in between. */
  previous: LineSegment | null;
  /** The line's period here after this one, when it returned. */
  next: LineSegment | null;
};
