import { INSIGHTS_CLEAR_VW } from '~/features/video/insights/insights.constants';
import type { VideoFraming, VideoPadding, VideoScene } from '~/features/video/video.types';

/** How fast the history plays: a little slower than the explorer's does at first, each change given time to be read. */
export const VIDEO_SPEED = 1.5;

/** How long the scenes that move on by themselves show, ms; the history and the plan end when their playback does. */
export const SCENE_MS: Partial<Record<VideoScene, number>> = {
  title: 4500,
  // The camera draws back to the panels' room, they come in round it, and hold.
  insights: 10_000,
  // The camera lies flat and draws back (`WHOLE_FIT_MS`), and the whole network holds for three seconds.
  overview: 5000,
  // Long enough to read: a plan's card says what it changes.
  end: 8000,
};

/** How long the plan's name shows over the map as it starts to play, ms, its fades included. */
export const PLAN_INTRO_MS = 6000;

/** How long the camera takes to draw back to the whole network, ms. */
export const WHOLE_FIT_MS = 2000;

/** How long anything takes to fade in or out, ms. */
export const FADE_MS = 600;

/** How far the minimap stands from the top of the frame, in `vmin`. */
export const MINIMAP_TOP_VMIN = 4;

/** How tall the minimap is, in `vmin`. */
export const MINIMAP_HEIGHT_VMIN = 22;

/** How far a plan's name stands from the top of the frame, in `vmin`: under the minimap, clear of it. */
export const PLAN_INTRO_TOP_VMIN = MINIMAP_TOP_VMIN + MINIMAP_HEIGHT_VMIN + 2;

/** How wide a plan's end card is, in `vw`: as it is laid out, and what the map keeps clear of. */
export const PLAN_END_VW = 30;

/** How far the network keeps from the edge beside a plan's end card, in `vw`: the card, the margin it stands at and some room. */
const PLAN_END_CLEAR_VW = PLAN_END_VW + 7;

/** Room kept clear at the map's edges while it plays, or shows the whole network: the year at the top, the caption at the bottom. */
const OPEN_MAP_PADDING_SHARES = { top: 0.16, bottom: 0.26, left: 0.08, right: 0.08 };

/**
 * Room kept clear at the map's edges, as shares of its size, for what lies over it. With the panels,
 * them down either side and the end card along the foot; with a plan's end card, that down one side,
 * the network given all the rest.
 */
export const VIDEO_PADDING_SHARES: Record<VideoFraming, VideoPadding> = {
  playing: OPEN_MAP_PADDING_SHARES,
  whole: OPEN_MAP_PADDING_SHARES,
  insights: { top: 0.08, bottom: 0.22, left: INSIGHTS_CLEAR_VW / 100, right: INSIGHTS_CLEAR_VW / 100 },
  ending: { top: 0.06, bottom: 0.06, left: PLAN_END_CLEAR_VW / 100, right: 0.05 },
};
