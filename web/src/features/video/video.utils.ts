import { yearOf } from '@railtime/core/date.utils';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { ChangeInfo, PlanInfo } from '@railtime/network/facts.types';
import type { MapProps, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { VideoPageState } from '@railtime/video/videoPage.types';
import {
  FADE_MS,
  OVERVIEW_SCENES,
  PLAN_TITLE_MS,
  TIMED_SCENES,
  TITLE_MS,
  VIDEO_PADDING_SHARES,
  VIDEO_PLAN_STATUSES,
  VIDEO_SPEED,
} from '~/features/video/video.constants';
import type { VideoLayers, VideoMapInput, VideoMoment, VideoPadding, VideoScene, VideoSize } from '~/features/video/video.types';

/**
 * The scene a video moves on to as time passes in one (`TIMED_SCENES`): the title to the history, a
 * plan's card to the plan, the overview to the end card, the end card to over. The history and a plan
 * end when their playback does, which the map says (`end`), not the time.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @returns The scene to show now.
 */
export const sceneAfter = (scene: VideoScene, elapsed: number): VideoScene => {
  const timed = TIMED_SCENES[scene];
  return timed && elapsed >= timed.ms ? timed.next : scene;
};

/**
 * The scene once the history, or a plan, has played to its end: the next plan's card, or the whole
 * network from above.
 *
 * @param planLeft - Whether a plan is still to play.
 * @returns The scene to show now.
 */
export const sceneAfterPlayback = (planLeft: boolean): VideoScene => (planLeft ? 'planTitle' : 'overview');

/**
 * Whether a scene shows the whole network from above, its coverage drawn.
 *
 * @param scene - The scene shown.
 * @returns Whether it is the overview, or the end card over it.
 */
export const isOverview = (scene: VideoScene): boolean => OVERVIEW_SCENES.has(scene);

/**
 * The plans a video plays after today, in order: what is being built, then what is committed to; the
 * rest (proposed, a concept, abandoned) stay in the explorer. A network never built plays its plan as
 * its history, and none after.
 *
 * @param plans - The network's plans, as they are kept.
 * @param planOnly - Whether the network was never built.
 * @returns The plans to play.
 */
export const videoPlansOf = (plans: PlanInfo[], planOnly: boolean): PlanInfo[] =>
  planOnly ? [] : VIDEO_PLAN_STATUSES.flatMap(status => plans.filter(plan => plan.status === status));

/**
 * Where the video is, as the page tells a recorder (`VideoPageHandle`): ready only once the city's
 * outline has come, or is known to be missing, so the overview's coverage is never left out of a take.
 *
 * @param scene - The scene shown.
 * @param outlineSettled - Whether the outline has come, or is known to be missing.
 * @returns Loading, ready, playing, or over.
 */
export const pageStateOf = (scene: VideoScene, outlineSettled: boolean): VideoPageState => {
  if (scene === 'ready') return outlineSettled ? 'ready' : 'loading';
  if (scene === 'loading' || scene === 'done') return scene;
  return 'playing';
};

/**
 * How far something shown has faded in: 0 before it starts, rising to 1 over the fade.
 *
 * @param elapsed - How long since it started to show, ms; negative before.
 * @param fadeMs - How long its fade takes.
 * @returns Its opacity, 0 to 1.
 */
export const fadedIn = (elapsed: number, fadeMs: number): number => Math.min(1, Math.max(0, elapsed / fadeMs));

/**
 * How much of something shown for a while shows now: fading in at its start and out at its end.
 *
 * @param elapsed - How long since it started to show, ms.
 * @param length - How long it shows, ms, its fades included.
 * @param fadeMs - How long each fade takes.
 * @returns Its opacity, 0 to 1.
 */
export const shownFor = (elapsed: number, length: number, fadeMs: number): number => Math.min(fadedIn(elapsed, fadeMs), fadedIn(length - elapsed, fadeMs));

/**
 * How much of the year and totals show in a scene: in with the history, on through the plans and the
 * overview, out as the end card comes.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @returns Their opacity, 0 to 1.
 */
const yearShownIn = (scene: VideoScene, elapsed: number): number => {
  switch (scene) {
    case 'history': {
      return fadedIn(elapsed, FADE_MS);
    }
    case 'planTitle':
    case 'plan':
    case 'overview': {
      return 1;
    }
    case 'end': {
      return 1 - fadedIn(elapsed, FADE_MS);
    }
    case 'loading':
    case 'ready':
    case 'title':
    case 'done': {
      return 0;
    }
  }
};

/**
 * How much of each piece over the map shows at a moment: the title, and a plan's card, over their
 * scenes, fading in and out; the year and totals (`yearShownIn`); a caption in as its change starts,
 * out once it goes, and never more than the year; the end card in over the overview, staying when the
 * video is over.
 *
 * @param moment - The scene and how long it has shown, and how long since the caption came and went.
 * @returns Each piece's opacity, 0 to 1.
 */
export const videoLayersOf = (moment: VideoMoment): VideoLayers => {
  const { scene, elapsed, sinceCaption, sinceCaptionGone } = moment;
  const title = scene === 'title' ? shownFor(elapsed, TITLE_MS, FADE_MS) : 0;
  const plan = scene === 'planTitle' ? shownFor(elapsed, PLAN_TITLE_MS, FADE_MS) : 0;
  const year = yearShownIn(scene, elapsed);
  const captionGone = sinceCaptionGone === null ? 1 : 1 - fadedIn(sinceCaptionGone, FADE_MS);
  const caption = Math.min(fadedIn(sinceCaption, FADE_MS), captionGone, year);
  let end = 0;
  if (scene === 'done') end = 1;
  else if (scene === 'end') end = fadedIn(elapsed, FADE_MS);
  return { title, plan, year, caption, end };
};

/**
 * The years a history spans, for its title: from its first change's to its last's.
 *
 * @param changes - Its changes, in order; a planned one, undated, is left out.
 * @returns "1960 – 2023", the one year for a history of one, or nothing for none.
 */
export const historySpan = (changes: ChangeInfo[]): string => {
  const years = changes.flatMap(change => (change.time === null ? [] : [yearOf(change.time)]));
  const first = years[0];
  const last = years.at(-1);
  if (first === undefined || last === undefined) return '';
  return first === last ? String(first) : `${first} – ${last}`;
};

/**
 * What the year card says: the year the history is in, or, while a plan plays, that it is a plan,
 * which has no date (its changes play at the end of the dates, today), as the explorer's time control
 * says it.
 *
 * @param time - Where the history is.
 * @returns "1995", or "Plan".
 */
export const videoYearOf = (time: TimeState): string => (time.inPlan ? 'Plan' : String(yearOf(time.time)));

/**
 * Room the camera keeps clear on a video of a size, so what it frames is never under the title, the
 * year or a caption.
 *
 * @param size - The video's size.
 * @returns The room at each edge, pixels.
 */
export const videoPaddingOf = (size: VideoSize): VideoPadding => ({
  top: Math.round(size.height * VIDEO_PADDING_SHARES.top),
  bottom: Math.round(size.height * VIDEO_PADDING_SHARES.bottom),
  left: Math.round(size.width * VIDEO_PADDING_SHARES.left),
  right: Math.round(size.width * VIDEO_PADDING_SHARES.right),
});

/**
 * How a video sees the map, as its address asks: in 3D, the city's buildings standing as the camera
 * comes down to each change, unless it asks for flat (`view=2d`).
 *
 * @param view - The address's `view`.
 * @returns 3D, or flat.
 */
export const videoViewOf = (view: unknown): ViewMode => (view === '2d' ? '2d' : '3d');

/**
 * What the map shows in a video: the network, dark, at the video's pace, without the basemap's street
 * names, framing clear of what lies over it; seen as asked until the overview, which lies flat, the
 * city's coverage drawn within its outline.
 *
 * @param input - The network shown, the frame's size, how it was asked to be seen, whether it is the overview, the outline.
 * @returns The map's props.
 */
export const videoMapPropsOf = (input: VideoMapInput): Pick<MapProps, 'facts'> & Partial<MapProps> => ({
  facts: input.facts,
  theme: 'dark',
  viewMode: input.overview ? '2d' : input.viewMode,
  overlay: input.overview && input.boundary ? { kind: 'coverage', metres: COVERAGE_DEFAULT_METRES } : null,
  boundary: input.boundary,
  speed: VIDEO_SPEED,
  streetLabels: false,
  padding: videoPaddingOf(input.size),
});

/**
 * The site's address as a video says it: without its scheme or its last slash.
 *
 * @param url - The address (`https://example.org/railtime/`).
 * @returns As written (`example.org/railtime`).
 */
export const spokenAddress = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
