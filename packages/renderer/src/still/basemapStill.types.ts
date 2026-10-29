import type { MapView, Theme } from '../transitMap.types';

/** What a `BasemapStill` is created with. */
export type BasemapStillOptions = {
  theme?: Theme;
  /** A MapLibre style URL using the OpenMapTiles schema. Defaults to the map's own. */
  basemap?: string;
  /** Where MapLibre's worker script is served, as for `TransitMap`. */
  workerUrl?: string;
};

/** One picture to take: where the basemap looks, and the picture's size in CSS pixels. */
export type StillRequest = { view: MapView; width: number; height: number };
