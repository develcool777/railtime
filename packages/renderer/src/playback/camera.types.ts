import type { LngLat } from '@railtime/schema/network.types';

/** Where the 3D camera looks from, following a line as it is drawn. */
export type Chase = {
  /** What it looks at. */
  center: LngLat;
  /** The way it faces, degrees clockwise from north. */
  bearing: number;
};
