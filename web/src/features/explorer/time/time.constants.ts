import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { PlayerSettings } from '~/features/explorer/explorer.types';
import type { TickMark } from '~/features/explorer/time/timeline.types';

/** Playback speeds offered: half speed to follow a line closely, in 3D above all. */
export const SPEED_OPTIONS = [0.5, 1, 2, 4].map(speed => ({ label: `${speed}×`, value: speed }));

/**
 * How playback is set without the address saying otherwise: at 2×, at which London's whole history
 * takes about five and a half minutes; the camera following; the minimap shown.
 */
export const DEFAULT_PLAYER: PlayerSettings = { speed: 2, camera: 'follow', minimap: true };

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

/** Each kind of change's mark, all in its line's colour: an opening whole, a closure faded, a rename half as tall. */
export const TICK_LOOK: Record<TickMark, string> = {
  opening: 'h-2',
  closure: 'h-2 opacity-40',
  rename: 'h-1',
};
