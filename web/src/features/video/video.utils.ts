import { yearOf } from '@railtime/core/date.utils';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import type { ChangeInfo, NetworkStats, PlanInfo } from '@railtime/network/facts.types';
import type { MapProps, TimeState, ViewMode } from '@railtime/renderer/transitMap.types';
import type { VideoPageState } from '@railtime/video/videoPage.types';
import { PLAN_STATUSES } from '~/constants/plan.constants';
import { FADE_MS, PLAN_INTRO_MS, SCENE_MS, VIDEO_INSIGHTS_PADDING_SHARES, VIDEO_PADDING_SHARES, VIDEO_SPEED } from '~/features/video/video.constants';
import type { VideoBeat, VideoFraming, VideoLayers, VideoMapInput, VideoMoment, VideoPadding, VideoScene, VideoSize } from '~/features/video/video.types';

/**
 * A video's script, every beat in order: its title and history, the whole network flat, then its
 * numbers round it, which its end card comes in over. With a plan it goes on past them: the plan
 * played from today, the network with it built flat, and the end card.
 *
 * @param plan - The plan it plays; `null` for none.
 * @returns The beats.
 */
export const videoScriptOf = (plan: PlanInfo | null): VideoBeat[] => {
  const asBuilt = (scene: VideoScene, framing: VideoFraming): VideoBeat => ({ scene, plan: null, framing });
  const opening = [
    asBuilt('ready', 'playing'),
    asBuilt('title', 'playing'),
    asBuilt('history', 'playing'),
    asBuilt('overview', 'whole'),
    asBuilt('insights', 'insights'),
  ];
  if (!plan) return [...opening, asBuilt('end', 'insights'), asBuilt('done', 'insights')];
  const ending = (['overview', 'end', 'done'] as const).map((scene): VideoBeat => ({ scene, plan, framing: 'whole' }));
  return [...opening, { scene: 'plan', plan, framing: 'playing' }, ...ending];
};

/**
 * Whether a scene has shown as long as it shows (`SCENE_MS`). The history and the plan end when their
 * playback does, which the map says (`end`), not the time.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @returns Whether its time is up.
 */
export const sceneEnded = (scene: VideoScene, elapsed: number): boolean => {
  const length = SCENE_MS[scene];
  return length !== undefined && elapsed >= length;
};

/**
 * The plan a video plays after its history: the one its address names, whatever its status, if the
 * network has it. None otherwise: a video ends on today unless asked. A network never built plays its
 * plan as its history, and none after.
 *
 * @param plans - The network's plans.
 * @param planOnly - Whether the network was never built.
 * @param asked - The plan its address names; `null` for none.
 * @returns The plan, or `null` for none.
 */
export const videoPlanOf = (plans: PlanInfo[], planOnly: boolean, asked: string | null): PlanInfo | null =>
  planOnly ? null : (plans.find(plan => plan.id === asked) ?? null);

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
 * Slows something down as it arrives.
 *
 * @param share - How far it has got at an even pace, 0 to 1.
 * @returns How far it has got, 0 to 1.
 */
export const easedOut = (share: number): number => 1 - (1 - share) ** 3;

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
 * How much of the minimap shows in a scene: in while the history or a plan plays, the camera close in,
 * and out as the whole network comes into view, which it has nothing to add to.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @returns Its opacity, 0 to 1.
 */
const minimapShownIn = (scene: VideoScene, elapsed: number): number => {
  if (scene === 'history' || scene === 'plan') return fadedIn(elapsed, FADE_MS);
  return scene === 'overview' ? 1 - fadedIn(elapsed, FADE_MS) : 0;
};

/**
 * How much of the year and totals show in a scene: in with the history, and on to the video's end.
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
    case 'insights':
    case 'plan':
    case 'overview':
    case 'end':
    case 'done': {
      return 1;
    }
    case 'loading':
    case 'ready':
    case 'title': {
      return 0;
    }
  }
};

/**
 * How much of each piece over the map shows at a moment: the title over its scene, and the plan's
 * name as it starts to play, fading in and out; the minimap (`minimapShownIn`); the year and totals (`yearShownIn`); a caption in as its change starts,
 * out once it goes, and never more than the year; the end card in at its scene, staying when the video
 * is over.
 *
 * @param moment - The scene and how long it has shown, and how long since the caption came and went.
 * @returns Each piece's opacity, 0 to 1.
 */
export const videoLayersOf = (moment: VideoMoment): VideoLayers => {
  const { scene, elapsed, sinceCaption, sinceCaptionGone } = moment;
  const title = scene === 'title' ? shownFor(elapsed, SCENE_MS.title ?? 0, FADE_MS) : 0;
  const planIntro = scene === 'plan' ? shownFor(elapsed, PLAN_INTRO_MS, FADE_MS) : 0;
  const minimap = minimapShownIn(scene, elapsed);
  const year = yearShownIn(scene, elapsed);
  const captionGone = sinceCaptionGone === null ? 1 : 1 - fadedIn(sinceCaptionGone, FADE_MS);
  const caption = Math.min(fadedIn(sinceCaption, FADE_MS), captionGone, year);
  let end = 0;
  if (scene === 'done') end = 1;
  else if (scene === 'end') end = fadedIn(elapsed, FADE_MS);
  return { title, planIntro, minimap, year, caption, end };
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
 * What the year card says: the year the history is in, or, on a plan, how far it has got, which has no
 * date (its changes play at the end of the dates, today).
 *
 * @param time - Where the history is.
 * @param plan - The plan laid on the network; `null` for none.
 * @returns "1995", or "Concept".
 */
export const videoYearOf = (time: TimeState, plan: PlanInfo | null): string => (plan ? PLAN_STATUSES[plan.status].label : String(yearOf(time.time)));

/**
 * Whether two sizes of the network are the same.
 *
 * @param first - One size.
 * @param second - The other.
 * @returns Whether its stations, track and lines all match.
 */
export const sameStats = (first: NetworkStats, second: NetworkStats): boolean =>
  first.stations === second.stations && first.km === second.km && first.lines === second.lines;

/**
 * The numbers shown as they count from one size of the network to another.
 *
 * @param from - What they count from.
 * @param to - What they count to.
 * @param share - How far they have got, 0 to 1.
 * @returns The numbers shown.
 */
export const statsBetween = (from: NetworkStats, to: NetworkStats, share: number): NetworkStats => ({
  stations: from.stations + (to.stations - from.stations) * share,
  km: from.km + (to.km - from.km) * share,
  lines: from.lines + (to.lines - from.lines) * share,
});

/**
 * Room the camera keeps clear on a video of a size, so what it frames is never under what lies over
 * the map: the year and a caption, or the panels.
 *
 * @param size - The video's size.
 * @param framing - How the map is seen.
 * @returns The room at each edge, pixels.
 */
export const videoPaddingOf = (size: VideoSize, framing: VideoFraming): VideoPadding => {
  const shares = framing === 'insights' ? VIDEO_INSIGHTS_PADDING_SHARES : VIDEO_PADDING_SHARES;
  return {
    top: Math.round(size.height * shares.top),
    bottom: Math.round(size.height * shares.bottom),
    left: Math.round(size.width * shares.left),
    right: Math.round(size.width * shares.right),
  };
};

/**
 * How a video sees the map, as its address asks: in 3D, the city's buildings standing as the camera
 * comes down to each change, unless it asks for flat (`view=2d`).
 *
 * @param view - The address's `view`.
 * @returns 3D, or flat.
 */
export const videoViewOf = (view: unknown): ViewMode => (view === '2d' ? '2d' : '3d');

/**
 * The plan a video's address names, not yet checked against the network.
 *
 * @param plan - The address's `plan`.
 * @returns Its id as written, or `null` for none, or one repeated.
 */
export const videoPlanAskedOf = (plan: unknown): string | null => (typeof plan === 'string' ? plan : null);

/**
 * What the map shows in a video: the network, dark, at the video's pace, without the basemap's street
 * names, framing clear of what lies over it; seen as asked while it plays, otherwise flat, with the
 * panels round it the city's coverage drawn within its outline.
 *
 * @param input - The network shown, the frame's size, how it was asked to be seen, the beat's framing, the outline.
 * @returns The map's props.
 */
export const videoMapPropsOf = (input: VideoMapInput): Pick<MapProps, 'facts'> & Partial<MapProps> => ({
  facts: input.facts,
  theme: 'dark',
  viewMode: input.framing === 'playing' ? input.viewMode : '2d',
  overlay: input.framing === 'insights' && input.boundary ? { kind: 'coverage', metres: COVERAGE_DEFAULT_METRES } : null,
  boundary: input.boundary,
  speed: VIDEO_SPEED,
  streetLabels: false,
  padding: videoPaddingOf(input.size, input.framing),
});

/**
 * The site's address as a video says it: without its scheme or its last slash.
 *
 * @param url - The address (`https://example.org/railtime/`).
 * @returns As written (`example.org/railtime`).
 */
export const spokenAddress = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
