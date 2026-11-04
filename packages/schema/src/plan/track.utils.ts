import { KM_PER_DEGREE_LATITUDE, KM_PER_DEGREE_LONGITUDE_AT_EQUATOR, RADIANS_PER_DEGREE } from '@railtime/core/geometry.constants';
import type { LngLat } from '@railtime/core/geometry.types';
import { cumulativeDistances, offsetKm, sliceAlong } from '@railtime/core/geometry.utils';
import { clamp } from '@railtime/core/number.utils';
import type { Heading } from './build.types';
import { HANDLE_SHARE, CURVE_STEP_KM, HEADING_SPAN_KM } from './track.constants.ts';

/**
 * Where a point falls on a track: the nearest point on it, and the track either side of it.
 *
 * @param coordinates - The track.
 * @param point - The point.
 * @returns The track up to the point, and from it on.
 */
export const splitTrack = (coordinates: LngLat[], point: LngLat): [LngLat[], LngLat[]] => {
  let best = { distance: Infinity, after: 0, on: point };
  for (const [index, from] of coordinates.slice(0, -1).entries()) {
    // Within bounds: index + 1 < coordinates.length.
    const to = coordinates[index + 1]!;
    const [eastward, northward] = [to[0] - from[0], to[1] - from[1]];
    const length = eastward * eastward + northward * northward;
    const along = length === 0 ? 0 : clamp(((point[0] - from[0]) * eastward + (point[1] - from[1]) * northward) / length, 0, 1);
    const on: LngLat = [from[0] + along * eastward, from[1] + along * northward];
    const distance = Math.hypot(on[0] - point[0], on[1] - point[1]);
    if (distance < best.distance) best = { distance, after: index, on };
  }
  return [
    [...coordinates.slice(0, best.after + 1), best.on],
    [best.on, ...coordinates.slice(best.after + 1)],
  ];
};

/**
 * The point some km east and north of another (`offsetKm` turned round).
 *
 * @param from - The point.
 * @param east - Km east.
 * @param north - Km north.
 * @returns The point there.
 */
const offsetBy = (from: LngLat, east: number, north: number): LngLat => [
  from[0] + east / (Math.cos(from[1] * RADIANS_PER_DEGREE) * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR),
  from[1] + north / KM_PER_DEGREE_LATITUDE,
];

/**
 * The way a track leaves its first point: towards its point `HEADING_SPAN_KM` along it, or its end
 * if it is shorter.
 *
 * @param track - The track.
 * @returns A step of 1 km that way, east and north; none for a track going nowhere.
 */
export const headingOf = (track: LngLat[]): Heading | null => {
  const distances = cumulativeDistances(track);
  const [east, north] = offsetKm(track[0]!, sliceAlong(track, distances, Math.min(HEADING_SPAN_KM, distances.at(-1) ?? 0)).at(-1) ?? track[0]!);
  const length = Math.hypot(east, north);
  return length > 0 ? [east / length, north / length] : null;
};

/**
 * A track from one point to another that leaves the first along one heading and comes into the second
 * along another, as a train's curves do: a cubic Bézier, each end's handle `HANDLE_SHARE` of the way
 * along its heading, its points `CURVE_STEP_KM` apart. Along the line between them, it is straight.
 *
 * @param from - Where it starts.
 * @param to - Where it ends.
 * @param leaving - The heading it leaves `from` on.
 * @param arriving - The heading it comes into `to` on.
 * @returns The track, from `from` to `to`.
 */
export const curveBetween = (from: LngLat, to: LngLat, leaving: Heading, arriving: Heading): LngLat[] => {
  const [east, north] = offsetKm(from, to);
  const reach = Math.hypot(east, north) * HANDLE_SHARE;
  // In km from `from`: its handles, then the end.
  const points: [number, number][] = [
    [0, 0],
    [leaving[0] * reach, leaving[1] * reach],
    [east - arriving[0] * reach, north - arriving[1] * reach],
    [east, north],
  ];
  const steps = Math.max(1, Math.ceil(Math.hypot(east, north) / CURVE_STEP_KM));
  return Array.from({ length: steps + 1 }, (_, step) => {
    if (step === 0) return from;
    if (step === steps) return to;
    const along = step / steps;
    const weights = [(1 - along) ** 3, 3 * along * (1 - along) ** 2, 3 * along ** 2 * (1 - along), along ** 3];
    // Within bounds: four weights for the four points.
    let x = 0;
    let y = 0;
    for (const [index, [pointX, pointY]] of points.entries()) {
      x += pointX * weights[index]!;
      y += pointY * weights[index]!;
    }
    return offsetBy(from, x, y);
  });
};
