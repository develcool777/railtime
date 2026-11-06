import { RADIANS_PER_DEGREE } from '@railtime/core/geometry.constants';
import type { Bounds, LngLat } from '@railtime/core/geometry.types';
import { offsetKm } from '@railtime/core/geometry.utils';
import type { MapOptions } from 'maplibre-gl';
import { MIN_TURN_KM, TURN_RATE } from './camera.constants';
import type { Chase } from './camera.types';
import type { ChaseTarget } from '../steps/animation.types';
import { OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../transitMap.constants';
import type { MapView, Padding } from '../transitMap.types';

/**
 * Where the map opens: a view the app linked to, or the whole network, fitted clear of the title, the
 * playback bar and the panels laid over the map.
 *
 * @param view - The view linked to, if any.
 * @param bounds - The network's bounds.
 * @param padding - The room the app's panels take up.
 * @param cover - The panels laid over the map's edges.
 * @returns The map's opening camera.
 */
export const openingOf = (
  view: MapView | undefined,
  bounds: Bounds,
  padding: Padding,
  cover: Padding,
): Pick<MapOptions, 'center' | 'zoom' | 'bounds' | 'fitBoundsOptions'> =>
  view
    ? { center: view.center, zoom: view.zoom }
    : {
        bounds,
        // Clear of the title and playback bar; the sides stay narrow, as their panels are small until playback.
        fitBoundsOptions: {
          padding: {
            top: padding.top + cover.top,
            bottom: padding.bottom + cover.bottom,
            left: OPENING_SIDE_PADDING + cover.left,
            right: OPENING_SIDE_PADDING + cover.right,
          },
          maxZoom: OPENING_MAX_ZOOM,
        },
      };

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
 * Where the 3D camera waits for a change: where it starts, facing the rest of it.
 *
 * @param start - Where the change starts.
 * @param towards - Somewhere along it: its middle.
 * @param bearing - The way the camera faces now, kept when the change goes nowhere (a lone station).
 * @returns Where to look from.
 */
export const chaseStartOf = (start: LngLat, towards: LngLat, bearing: number): Chase => ({ center: start, bearing: bearingBetween(start, towards) ?? bearing });

/**
 * The 3D camera's next frame, following a line as it grows: it sits where the line's path says, which
 * rounds its bends, and turns, slowly, to face the way the path goes on, so a sharp bend is taken in a
 * sweep, never a jolt.
 *
 * @param chase - Where it looks from now.
 * @param target - Where to look from this frame, and which way.
 * @param seconds - The time since the last frame.
 * @returns Where it looks from next.
 */
export const followOf = (chase: Chase, target: ChaseTarget, seconds: number): Chase => {
  const heading = bearingBetween(target.behind, target.ahead);
  if (heading === null) return { center: target.center, bearing: chase.bearing };
  // The shorter way round, so the camera never spins through a full turn.
  const turn = ((((heading - chase.bearing) % 360) + 540) % 360) - 180;
  return { center: target.center, bearing: chase.bearing + turn * (1 - Math.exp(-seconds * TURN_RATE)) };
};
