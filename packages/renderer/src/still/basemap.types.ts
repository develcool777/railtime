import type { LngLat } from '@railtime/core/geometry.types';
import type { Theme } from '@railtime/network/facts.types';
import type { CreateMap } from '../transitMap.types';

/** What a `BasemapStill` is created with. */
export type BasemapStillOptions = {
  theme?: Theme;
  /** Where MapLibre's worker script is served, as for `TransitMap`. */
  workerUrl?: string;
  /** Makes the hidden map: MapLibre's own unless a test gives a stand-in. */
  createMap?: CreateMap;
};

/** A line's track drawn over a still, in one theme's colour: dashed for track not built. */
export type StillTrack = { color: string; paths: LngLat[][]; dashed?: boolean };

/**
 * One picture to take: what it frames, as the map frames a network (`cameraForBounds`), its size in CSS
 * pixels, any track to draw over it (bottom first), and its format: WebP unless asked otherwise.
 */
export type StillRequest = {
  /** The points to frame; at least one. */
  points: LngLat[];
  /** Room kept round them, CSS pixels. */
  padding: number;
  /** The deepest it zooms, for points close together. */
  maxZoom: number;
  width: number;
  height: number;
  track?: StillTrack[];
  format?: 'image/webp' | 'image/jpeg';
};
