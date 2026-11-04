import type { StationId } from '@railtime/schema/network.types';
import type { TrackSegment, Travel } from './engine.types';

/** A segment of a chain, with its direction of travel along it. */
export type ChainLink = { segment: TrackSegment; travel: Travel };

/** A run of track between junctions (stations where other than two segments meet). */
export type Chain = {
  /** Segments in order from `start` to `end`. */
  segments: ChainLink[];
  start: StationId;
  end: StationId;
};
