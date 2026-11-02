import type { LngLat } from '@railtime/core/geometry.types';
import type { SegmentLine } from '../format/network.types';

/** A line's track leaving a station, from the station's end, and when the line runs on it: `null` for a plan's, which runs whenever the line does. */
export type TrackOut = { track: LngLat[]; dates: SegmentLine | null };
