import type { TrackSegment } from '../model/networkIndex.types';

/** How one segment of a growing stretch draws. */
export type SegmentPlan = {
  segment: TrackSegment;
  /** Draws from station A towards B (else from B towards A). */
  fromStationA: boolean;
  /** How far the growth front has travelled, km, when this segment starts drawing. */
  startKm: number;
};

/** How a stretch of new track grows. */
export type Growth = {
  plans: SegmentPlan[];
  /** How far the growth front travels in all. */
  totalKm: number;
  /** Every station of the stretch in the order the front reaches it; `isNew` if it was not on the map before. */
  reach: { station: string; km: number; isNew: boolean }[];
};
