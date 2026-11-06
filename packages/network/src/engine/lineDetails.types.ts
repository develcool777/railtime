import type { StationId } from '@railtime/schema/network.types';
import type { LineSegment } from './engine.types';

/** A run of a line's track: its stations, the track between each and the next, and the stops a list of them shows. */
export type LineRun = {
  stations: StationId[];
  track: LineSegment[];
  stops: StationId[];
  /** Its trains go only the way its stations run: a loop whose line says which way round (`Line.way`). */
  oneWay: boolean;
};

/** A ride from a stop to the next, as a line's trains go: over a junction or a station they pass, but never past a stop. */
export type LineHop = {
  to: StationId;
  km: number;
  /** The track it rides, by `TrackSegment.index`. */
  segments: number[];
};
