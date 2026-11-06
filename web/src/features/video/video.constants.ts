import type { VideoScene } from '~/features/video/video.types';

/** How fast the history plays: a little slower than the explorer's does at first, each change given time to be read. */
export const VIDEO_SPEED = 1.5;

/** How long the scenes that move on by themselves show, ms; the history and the plan end when their playback does. */
export const SCENE_MS: Partial<Record<VideoScene, number>> = {
  title: 4500,
  // The camera draws back to the panels' room, they come in round it, and hold.
  insights: 10_000,
  // The camera lies flat and draws back (`WHOLE_FIT_MS`), and the whole network holds for three seconds.
  overview: 5000,
  end: 6000,
};

/** How long the plan's name shows over the map as it starts to play, ms, its fades included. */
export const PLAN_INTRO_MS = 6000;

/** How long the numbers take to count to a new value, ms. */
export const COUNT_MS = 900;

/** How long the camera takes to draw back to the whole network, ms. */
export const WHOLE_FIT_MS = 2000;

/** How long anything takes to fade in or out, ms. */
export const FADE_MS = 600;

/** Room kept clear at the map's edges, as shares of its size: the year at the top, the caption at the bottom. */
export const VIDEO_PADDING_SHARES = { top: 0.16, bottom: 0.26, left: 0.08, right: 0.08 };

/** Room kept clear with the panels round the map: them down either side, the end card along the foot. */
export const VIDEO_INSIGHTS_PADDING_SHARES = { top: 0.08, bottom: 0.22, left: 0.3, right: 0.3 };
