import type { LngLat } from '@railtime/core/geometry.types';
import { clamp } from '@railtime/core/number.utils';
import { RADIANS_PER_DEGREE } from '@railtime/core/geometry.constants';
import { offsetKm } from '@railtime/core/geometry.utils';
import { CHASE_ZOOM_AT_1KM, CHASE_ZOOM_PER_DOUBLING, CLOSE_UP_MAX_ZOOM, CLOSE_UP_MIN_ZOOM, FOLLOW_RATE, MIN_TURN_KM, TURN_RATE } from './camera.constants';
import type { Chase } from './camera.types';

/**
 * The way from one point to another.
 *
 * @param from - Where from.
 * @param to - Where to.
 * @returns Degrees clockwise from north; `null` when the two are about the same point.
 */
const bearingBetween = (from: LngLat, to: LngLat): number | null => {
  const [east, north] = offsetKm(from, to);
  return Math.hypot(east, north) < MIN_TURN_KM ? null : Math.atan2(east, north) / RADIANS_PER_DEGREE;
};

/**
 * How close the 3D camera follows a stretch as it is drawn: a short one from street level, a long one
 * from farther off, so the growing tip crosses the screen at about the same pace.
 *
 * @param lengthKm - The stretch's length.
 * @returns A zoom.
 */
export const chaseZoomOf = (lengthKm: number): number =>
  clamp(CHASE_ZOOM_AT_1KM - Math.log2(Math.max(lengthKm, 0.01)) * CHASE_ZOOM_PER_DOUBLING, CLOSE_UP_MIN_ZOOM, CLOSE_UP_MAX_ZOOM);

/**
 * Where the 3D camera waits for a change: where it starts, facing the rest of it.
 *
 * @param start - Where the change starts.
 * @param towards - Somewhere along it: its middle.
 * @param bearing - The way the camera faces now, kept when the change goes nowhere (a lone station).
 * @returns Where to look from.
 */
export const chaseStartOf = (start: LngLat, towards: LngLat, bearing: number): Chase => ({ center: start, bearing: bearingBetween(start, towards) ?? bearing });

/**
 * The 3D camera's next frame, following a line as it grows: it closes on the growing tips and turns,
 * more slowly, to face the way they move, so it glides after them rather than jumping.
 *
 * @param chase - Where it looks from now.
 * @param tips - The growing tips this frame; one at least.
 * @param seconds - The time since the last frame.
 * @returns Where it looks from next.
 */
export const followOf = (chase: Chase, tips: LngLat[], seconds: number): Chase => {
  const target: LngLat = [tips.reduce((sum, tip) => sum + tip[0], 0) / tips.length, tips.reduce((sum, tip) => sum + tip[1], 0) / tips.length];
  const closing = 1 - Math.exp(-seconds * FOLLOW_RATE);
  const center: LngLat = [chase.center[0] + (target[0] - chase.center[0]) * closing, chase.center[1] + (target[1] - chase.center[1]) * closing];
  const heading = bearingBetween(chase.center, target);
  if (heading === null) return { center, bearing: chase.bearing };
  // The shorter way round, so the camera never spins through a full turn.
  const turn = ((((heading - chase.bearing) % 360) + 540) % 360) - 180;
  return { center, bearing: chase.bearing + turn * (1 - Math.exp(-seconds * TURN_RATE)) };
};
