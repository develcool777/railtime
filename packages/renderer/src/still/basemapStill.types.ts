import type { LngLat } from '@railtime/schema/network.types';
import type { MapView, Theme } from '../transitMap.types';

/** What a `BasemapStill` is created with. */
export type BasemapStillOptions = {
  theme?: Theme;
  /** A MapLibre style URL using the OpenMapTiles schema. Defaults to the map's own. */
  basemap?: string;
  /** Where MapLibre's worker script is served, as for `TransitMap`. */
  workerUrl?: string;
};

/** A line's track drawn over a still, in one theme's colour: dashed for track not built. */
export type StillTrack = { color: string; paths: LngLat[][]; dashed?: boolean };

/**
 * One picture to take: where the basemap looks, the picture's size in CSS pixels, any track to draw
 * over it (bottom first), and its format: WebP unless asked otherwise.
 */
export type StillRequest = { view: MapView; width: number; height: number; track?: StillTrack[]; format?: 'image/webp' | 'image/jpeg' };
