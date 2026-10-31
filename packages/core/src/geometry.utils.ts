import type { LngLat } from './geometry.types';
import { KM_PER_DEGREE_LATITUDE, KM_PER_DEGREE_LONGITUDE_AT_EQUATOR, RADIANS_PER_DEGREE } from './geometry.constants';
import type { Bounds } from './geometry.types';

/**
 * How far east and north one point is of another, by an equirectangular approximation at their own
 * latitude: degrees of longitude shrink towards the poles, so they are scaled by the cosine of the
 * points' mean latitude. Well under 1% off at city scale, in any city.
 *
 * @param from - The first point.
 * @param to - The second point.
 * @returns Km east and km north from `from` to `to`.
 */
export const offsetKm = (from: LngLat, to: LngLat): [number, number] => {
  const longitudeScale = Math.cos(((from[1] + to[1]) / 2) * RADIANS_PER_DEGREE);
  return [(to[0] - from[0]) * longitudeScale * KM_PER_DEGREE_LONGITUDE_AT_EQUATOR, (to[1] - from[1]) * KM_PER_DEGREE_LATITUDE];
};

/**
 * Distance between two points (`offsetKm`).
 *
 * @param from - The first point.
 * @param to - The second point.
 * @returns The distance in km.
 */
export const distanceKm = (from: LngLat, to: LngLat): number => Math.hypot(...offsetKm(from, to));

/**
 * The point a fraction of the way from one point to another.
 *
 * @param from - Where the fraction is 0.
 * @param to - Where the fraction is 1.
 * @param fraction - How far along, 0..1.
 * @returns The point.
 */
const interpolate = (from: LngLat, to: LngLat, fraction: number): LngLat => [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction];

/**
 * How far along a polyline each of its points lies.
 *
 * @param coordinates - The polyline.
 * @returns The distance from the first point to each point, in km.
 */
export const cumulativeDistances = (coordinates: LngLat[]): number[] =>
  coordinates.reduce<number[]>((distances, point, index) => {
    const previous = coordinates[index - 1];
    distances.push(previous ? (distances.at(-1) ?? 0) + distanceKm(previous, point) : 0);
    return distances;
  }, []);

/**
 * The first stretch of a polyline, ending on an interpolated point.
 *
 * @param coordinates - The polyline.
 * @param distances - Its `cumulativeDistances`.
 * @param lengthKm - How much of it to keep.
 * @returns The polyline's first `lengthKm`.
 */
export const sliceAlong = (coordinates: LngLat[], distances: number[], lengthKm: number): LngLat[] => {
  const kept = coordinates.slice(0, 1);
  for (let index = 1; index < coordinates.length; index++) {
    // Within bounds: `distances` has one entry per coordinate.
    const point = coordinates[index]!;
    const pointKm = distances[index]!;
    if (pointKm <= lengthKm) {
      kept.push(point);
      continue;
    }
    const previousKm = distances[index - 1]!;
    const fraction = (lengthKm - previousKm) / (pointKm - previousKm);
    if (fraction > 0) kept.push(interpolate(coordinates[index - 1]!, point, fraction));
    break;
  }
  return kept;
};

/**
 * The bounding box of some points.
 *
 * @param points - The points.
 * @returns South-west and north-east corners, or `null` without points.
 */
export const boundsOf = (points: Iterable<LngLat>): Bounds | null => {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  }
  return west === Infinity
    ? null
    : [
        [west, south],
        [east, north],
      ];
};

/**
 * Web Mercator's y of a latitude: the map's own vertical scale.
 *
 * @param latitude - Degrees.
 * @returns Its y.
 */
export const mercatorY = (latitude: number): number => Math.log(Math.tan(Math.PI / 4 + (latitude * RADIANS_PER_DEGREE) / 2));

/**
 * The latitude of a Web Mercator y: `mercatorY` undone.
 *
 * @param y - A y.
 * @returns Degrees.
 */
export const latitudeOf = (y: number): number => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RADIANS_PER_DEGREE;
