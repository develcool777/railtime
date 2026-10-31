import type { LngLat } from '@railtime/core/geometry.types';

/** The grid's image corners, as MapLibre's image source takes them: top left, top right, bottom right, bottom left. */
export type GridCorners = [LngLat, LngLat, LngLat, LngLat];
