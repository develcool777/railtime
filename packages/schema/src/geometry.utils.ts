import type { LngLat } from './network.types';

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
    const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - from[0]) * eastward + (point[1] - from[1]) * northward) / length));
    const on: LngLat = [from[0] + along * eastward, from[1] + along * northward];
    const distance = Math.hypot(on[0] - point[0], on[1] - point[1]);
    if (distance < best.distance) best = { distance, after: index, on };
  }
  return [
    [...coordinates.slice(0, best.after + 1), best.on],
    [best.on, ...coordinates.slice(best.after + 1)],
  ];
};

/** Metres in a degree of latitude, and of longitude at the equator. */
const METRES_PER_DEGREE = 111_320;

/**
 * About how far apart two nearby points are: flat, which is close enough within a city.
 *
 * @param first - One point.
 * @param second - The other.
 * @returns The distance, metres.
 */
export const metresBetween = (first: LngLat, second: LngLat): number => {
  const latitude = (((first[1] + second[1]) / 2) * Math.PI) / 180;
  return Math.hypot((first[0] - second[0]) * METRES_PER_DEGREE * Math.cos(latitude), (first[1] - second[1]) * METRES_PER_DEGREE);
};
