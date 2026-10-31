import type { MapProps } from '../transitMap.types';
import type { LngLat } from '@railtime/core/geometry.types';

/** Where the 3D camera looks from, following a line as it is drawn. */
export type Chase = {
  /** What it looks at. */
  center: LngLat;
  /** The way it faces, degrees clockwise from north. */
  bearing: number;
};

/** What the camera reads from the map's props: the room to keep clear, how it follows playback, and the view. */
export type CameraSettings = Pick<MapProps, 'padding' | 'camera' | 'viewMode'>;
