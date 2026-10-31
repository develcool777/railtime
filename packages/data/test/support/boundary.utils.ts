import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat } from '@railtime/schema/network.types';

/**
 * Whether an outline holds a point: inside one of its polygons' outer rings and none of their holes.
 *
 * @param boundary - The outline.
 * @param point - The point.
 * @returns True if it does.
 */
export const holds = (boundary: CityBoundary, point: LngLat): boolean => {
  const [longitude, latitude] = point;
  const inRing = (ring: LngLat[]) =>
    ring.slice(0, -1).reduce((inside, [fromX, fromY], position) => {
      // Within bounds: a ring's next point, the last being the first.
      const [toX, toY] = ring[position + 1]!;
      return fromY > latitude !== toY > latitude && longitude < fromX + ((latitude - fromY) * (toX - fromX)) / (toY - fromY) ? !inside : inside;
    }, false);
  return boundary.polygons.some(([outer = [], ...holes]) => inRing(outer) && !holes.some(inRing));
};
