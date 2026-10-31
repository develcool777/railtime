import type { LngLat } from '@railtime/schema/network.types';
import { RADIANS_PER_DEGREE } from '../core/geometry.constants';
import { boundsOf } from '../core/geometry.utils';
import type { CloseUp } from './camera.types';

/**
 * Where the 3D camera looks at a change from: its middle, turned so the change runs up the screen,
 * from its first point towards its last, as a drone following a new line.
 *
 * @param points - The change's points, in order; one at least.
 * @param bearing - The camera's turn now, kept for a change with no length: a lone station.
 * @returns The middle to look at and the turn to look from, degrees clockwise from north.
 */
export const closeUpOf = (points: LngLat[], bearing: number): CloseUp => {
  const bounds = boundsOf(points);
  const first = points[0];
  const last = points.at(-1);
  if (!bounds || !first || !last) throw new Error('a close-up needs a point at least');
  const [[west, south], [east, north]] = bounds;
  const eastward = (last[0] - first[0]) * Math.cos(first[1] * RADIANS_PER_DEGREE);
  const northward = last[1] - first[1];
  return {
    center: [(west + east) / 2, (south + north) / 2],
    bearing: eastward === 0 && northward === 0 ? bearing : Math.atan2(eastward, northward) / RADIANS_PER_DEGREE,
  };
};
