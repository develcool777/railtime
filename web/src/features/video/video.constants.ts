import type { PlanStatus } from '@railtime/schema/network.types';
import type { TimedScene, VideoScene } from '~/features/video/video.types';

/** How fast the history plays: as the explorer's does at first, a change about every two seconds. */
export const VIDEO_SPEED = 2;

/** How long the title shows before the history plays, ms. */
export const TITLE_MS = 4500;

/** How long a plan's card shows before the plan plays, ms. */
export const PLAN_TITLE_MS = 4000;

/** How long the whole network shows from above, its coverage drawn, before the end card, ms: the camera lies flat and pulls back first. */
export const OVERVIEW_MS = 6000;

/** How long the end card shows before the video is over, ms. */
export const END_MS = 5000;

/** The scenes that move on by themselves, each once it has shown so long; the history and a plan end when their playback does. */
export const TIMED_SCENES: Partial<Record<VideoScene, TimedScene>> = {
  title: { ms: TITLE_MS, next: 'history' },
  planTitle: { ms: PLAN_TITLE_MS, next: 'plan' },
  overview: { ms: OVERVIEW_MS, next: 'end' },
  end: { ms: END_MS, next: 'done' },
};

/** The plans a video plays after today, in this order: what is being built, then what is committed to. */
export const VIDEO_PLAN_STATUSES: readonly PlanStatus[] = ['under-construction', 'planned'];

/** The scenes the whole network shows from above in, its coverage drawn. */
export const OVERVIEW_SCENES: ReadonlySet<VideoScene> = new Set(['overview', 'end', 'done']);

/** How long anything takes to fade in or out, ms. */
export const FADE_MS = 600;

/** Room kept clear at the map's edges, as shares of its size: the year at the top, the caption at the bottom. */
export const VIDEO_PADDING_SHARES = { top: 0.16, bottom: 0.26, left: 0.08, right: 0.08 };
