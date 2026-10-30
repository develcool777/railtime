import type { Padding } from './transitMap.types';

/** Room kept clear around the map's edges when no padding is given. */
export const DEFAULT_PADDING: Padding = { top: 140, bottom: 120, left: 60, right: 60 };

/** No panel over the map's edges. */
export const NO_COVER: Padding = { top: 0, bottom: 0, left: 0, right: 0 };

/** Room kept clear at the map's sides when it first opens, pixels. */
export const OPENING_SIDE_PADDING = 40;

/** The closest the map opens on a whole network: a short line keeps some city around it. */
export const OPENING_MAX_ZOOM = 12.5;

/** Longest frame step, seconds: after a background tab, playback resumes instead of jumping ahead. */
export const MAX_FRAME_SECONDS = 0.05;

/** Labels of a step's new stations fade over the last part of its hold. */
export const NEW_LABEL_FADE_FRACTION = 0.3;

/** Zoom when flying to a selected station, at least. */
export const SELECTED_STATION_ZOOM = 13;

/** How long the camera takes to fly to a selected station, ms. */
export const SELECT_FLY_MS = 800;

/** Room the camera keeps beside a route it frames, pixels: its stops' names are written to their right. */
export const ROUTE_NAME_ROOM = { right: 110, top: 12, bottom: 12 };

/** How long the camera takes to fit the whole network, ms. */
export const FIT_NETWORK_MS = 1200;

/** How long the camera takes to pull back to the whole network when playback ends, ms. */
export const END_OVERVIEW_MS = 2000;
