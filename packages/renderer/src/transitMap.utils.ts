import type { LngLatBoundsLike, MapOptions } from 'maplibre-gl';
import type { Bounds } from '@railtime/core/geometry.types';
import { OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from './transitMap.constants';
import type { MapView, Padding } from './transitMap.types';

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
        bounds: bounds as LngLatBoundsLike,
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
