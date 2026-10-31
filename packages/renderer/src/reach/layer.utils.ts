import { required } from '../core/required.utils';
import type { PointFeature, ReachStopProperties, ReachTrackFeature } from '../layers/features.types';
import { pointFeature } from '../layers/features.utils';
import type { NetworkIndex } from '../network/index.service';
import type { TrackSegment } from '../network/index.types';
import type { Timeline } from '../network/timeline.service';
import type { ReachInfo } from '../transitMap.types';
import { REACH_BANDS } from './layer.constants';
import type { ReachedSegment } from './layer.types';

/**
 * The band a time falls in.
 *
 * @param minutes - How long it takes.
 * @returns The band's place in `REACH_BANDS`.
 */
export const bandOf = (minutes: number): number => {
  const band = REACH_BANDS.findIndex(entry => entry.upTo === null || minutes <= entry.upTo);
  return band === -1 ? REACH_BANDS.length - 1 : band;
};

/**
 * The track a reach colours: each open segment with a reached station at an end, timed as the mean
 * of its ends' times, or the one end's when only one is reached (a station its lines pass by).
 *
 * @param minutes - Minutes to each station reached, by id.
 * @param segments - The segments open on the date, each once.
 * @param segments.index - The segment's id.
 * @param segments.stationA - One end.
 * @param segments.stationB - The other end.
 * @returns The segments reached, with their times.
 */
export const reachedSegments = (
  minutes: ReadonlyMap<string, number>,
  segments: Iterable<{ index: number; stationA: string; stationB: string }>,
): ReachedSegment[] => {
  const reached: ReachedSegment[] = [];
  for (const segment of segments) {
    const ends = [minutes.get(segment.stationA), minutes.get(segment.stationB)].filter((time): time is number => time !== undefined);
    if (ends.length > 0) reached.push({ segment: segment.index, minutes: ends.reduce((total, time) => total + time, 0) / ends.length });
  }
  return reached;
};

/**
 * The track a reach colours, each segment in the band of its time.
 *
 * @param index - The network.
 * @param timeline - When each line runs.
 * @param cursor - The cursor the reach was found at.
 * @param reach - The reach, or `null`.
 * @returns The track; none without a reach.
 */
export const reachTrack = (index: NetworkIndex, timeline: Timeline, cursor: number, reach: ReachInfo | null): ReachTrackFeature[] => {
  if (!reach) return [];
  const minutes = new Map<string, number>([[reach.from.id, 0], ...reach.stations.map(station => [station.id, station.minutes] as const)]);
  const open = new Map<number, TrackSegment>();
  for (const lineSegment of index.lineSegments) if (timeline.isOpen(lineSegment, cursor)) open.set(lineSegment.segment.index, lineSegment.segment);
  return reachedSegments(minutes, open.values()).map(({ segment, minutes: time }) => ({
    type: 'Feature',
    properties: { color: required(REACH_BANDS[bandOf(time)], 'reach band').color },
    geometry: { type: 'LineString', coordinates: required(index.segments[segment], `segment ${segment}`).coordinates },
  }));
};

/**
 * The stations a reach gets to, each in its band's colour and named with its time, the start first.
 *
 * @param index - The network.
 * @param reach - The reach, or `null`.
 * @returns The stations; none without a reach.
 */
export const reachStops = (index: NetworkIndex, reach: ReachInfo | null): PointFeature<ReachStopProperties>[] =>
  reach
    ? [
        pointFeature(index.coordOf(reach.from.id), { color: required(REACH_BANDS[0], 'reach band').color, label: reach.from.name, minutes: 0, origin: true }),
        ...reach.stations.map(station =>
          pointFeature(index.coordOf(station.id), {
            color: required(REACH_BANDS[station.band], 'reach band').color,
            label: `${station.name} · ${Math.round(station.minutes)} min`,
            minutes: station.minutes,
            origin: false,
          }),
        ),
      ]
    : [];
