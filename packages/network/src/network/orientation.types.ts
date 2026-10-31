import type { TrackSegment, Travel } from './engine.types';

/** A run of track between junctions (stations where other than two segments meet). */
export type Chain = {
  /** Segments in order from `start` to `end`, each with its direction of travel along the chain. */
  segments: { segment: TrackSegment; travel: Travel }[];
  start: string;
  end: string;
};
