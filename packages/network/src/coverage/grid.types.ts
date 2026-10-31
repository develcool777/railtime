import type { LngLat } from '@railtime/schema/network.types';

/** The grid's image corners, as MapLibre's image source takes them: top left, top right, bottom right, bottom left. */
export type GridCorners = [LngLat, LngLat, LngLat, LngLat];
