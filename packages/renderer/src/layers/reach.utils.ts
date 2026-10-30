import { REACH_BANDS } from './reach.constants';
import type { ReachedSegment } from './reach.types';

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
