import type { CameraMode } from '@railtime/renderer/transitMap.types';

/** Playback speeds offered: half speed to follow a line closely, in 3D above all. */
export const SPEED_OPTIONS = [0.5, 1, 2, 4].map(speed => ({ label: `${speed}×`, value: speed }));

/** Default playback speed: London's whole history takes about five and a half minutes. */
export const DEFAULT_SPEED = 2;

/** Camera modes offered during playback, each with what it does. */
export const CAMERA_OPTIONS: { label: string; value: CameraMode; description: string }[] = [
  { label: 'Follow', value: 'follow', description: 'Goes to each change; in 3D, rides along the line as it grows' },
  { label: 'Overview', value: 'overview', description: 'Keeps the whole network in sight' },
  { label: 'Free', value: 'free', description: 'Stays where you leave it' },
];

/** The share of the timeline a plan's changes take, at its right end. */
export const FUTURE_SHARE = 0.16;

/** How many marks of one year stack on the timeline before they overlap. */
export const MAX_TICK_LEVEL = 3;

/** Years between the labels under the timeline. */
export const TIMELINE_LABEL_YEARS = 25;
