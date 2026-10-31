import { pushTo } from '@railtime/core/collection.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { distanceKm } from '@railtime/core/geometry.utils';
import type { LineSegment, TrackSegment } from './engine.types';

/**
 * Splits one day's openings for one line into connected stretches, nearest the network's centre first.
 * Each stretch plays as its own step.
 *
 * @param lineSegments - The line segments opening.
 * @param coordOf - Where a station is.
 * @param centre - The network's centre.
 * @returns The stretches.
 */
export const connectedStretches = (lineSegments: LineSegment[], coordOf: (station: string) => LngLat, centre: LngLat): LineSegment[][] => {
  const bySegment = new Map<TrackSegment, LineSegment[]>();
  for (const lineSegment of lineSegments) pushTo(bySegment, lineSegment.segment, lineSegment);
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of bySegment.keys()) for (const station of [segment.stationA, segment.stationB]) pushTo(segmentsAt, station, segment);

  const seen = new Set<TrackSegment>();
  const stretches: { lineSegments: LineSegment[]; distanceToCentre: number }[] = [];
  for (const start of bySegment.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const queue = [start];
    const stretch: LineSegment[] = [];
    let distanceToCentre = Infinity;
    while (queue.length > 0) {
      const segment = queue.pop()!;
      stretch.push(...bySegment.get(segment)!);
      for (const station of [segment.stationA, segment.stationB]) {
        distanceToCentre = Math.min(distanceToCentre, distanceKm(coordOf(station), centre));
        for (const next of segmentsAt.get(station)!) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
    }
    stretches.push({ lineSegments: stretch, distanceToCentre });
  }
  return stretches.sort((first, second) => first.distanceToCentre - second.distanceToCentre).map(stretch => stretch.lineSegments);
};
