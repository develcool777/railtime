import type { LngLat } from '@railtime/schema/network.types';

/** Where the 3D camera looks at a change from. */
export type CloseUp = {
  /** The change's middle. */
  center: LngLat;
  /** The turn to look from, degrees clockwise from north: the change runs up the screen. */
  bearing: number;
};
