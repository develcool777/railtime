import { yearOf } from '@railtime/core/date.utils';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { ChangeInfo } from '@railtime/network/facts.types';
import type { MapProps } from '@railtime/renderer/transitMap.types';
import type { VideoPageState } from '@railtime/video/videoPage.types';
import { END_CARD_DELAY_MS, END_MS, FADE_MS, TITLE_MS, VIDEO_PADDING_SHARES, VIDEO_SPEED } from '~/features/video/video.constants';
import type { VideoLayers, VideoMoment, VideoPadding, VideoScene, VideoSize } from '~/features/video/video.types';

/**
 * The scene a video moves on to as time passes in one: the title to the history, the end card to
 * over. The history ends when its playback does, which the map says (`end`), not the time.
 *
 * @param scene - The scene shown.
 * @param elapsed - How long it has shown, ms.
 * @returns The scene to show now.
 */
export const sceneAfter = (scene: VideoScene, elapsed: number): VideoScene => {
  if (scene === 'title' && elapsed >= TITLE_MS) return 'history';
  if (scene === 'end' && elapsed >= END_MS) return 'done';
  return scene;
};

/**
 * Where the video is, as the page tells a recorder (`VideoPageHandle`).
 *
 * @param scene - The scene shown.
 * @returns Loading, ready, playing, or over.
 */
export const pageStateOf = (scene: VideoScene): VideoPageState => {
  if (scene === 'loading' || scene === 'ready' || scene === 'done') return scene;
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
 * How much of each piece over the map shows at a moment: the title over its scene, fading in and
 * out; the year and totals in with the history, out as the end card comes; a caption in as its
 * change starts, out once it goes, and never more than the year; the end card in once the camera
 * has moved to the whole network, staying when the video is over.
 *
 * @param moment - The scene and how long it has shown, and how long since the caption came and went.
 * @returns Each piece's opacity, 0 to 1.
 */
export const videoLayersOf = (moment: VideoMoment): VideoLayers => {
  const { scene, elapsed, sinceCaption, sinceCaptionGone } = moment;
  const title = scene === 'title' ? shownFor(elapsed, TITLE_MS, FADE_MS) : 0;
  let year = 0;
  if (scene === 'history') year = fadedIn(elapsed, FADE_MS);
  // Gone just as the end card starts to come.
  else if (scene === 'end') year = 1 - fadedIn(elapsed - END_CARD_DELAY_MS + FADE_MS, FADE_MS);
  const captionGone = sinceCaptionGone === null ? 1 : 1 - fadedIn(sinceCaptionGone, FADE_MS);
  const caption = Math.min(fadedIn(sinceCaption, FADE_MS), captionGone, year);
  let end = 0;
  if (scene === 'done') end = 1;
  else if (scene === 'end') end = fadedIn(elapsed - END_CARD_DELAY_MS, FADE_MS);
  return { title, year, caption, end };
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
 * What the map shows in a video: the network, dark, at the video's pace, without the basemap's
 * street names, framing clear of what lies over it.
 *
 * @param facts - The city's network.
 * @param size - The video's size.
 * @returns The map's props.
 */
export const videoMapPropsOf = (facts: NetworkFacts, size: VideoSize): Pick<MapProps, 'facts'> & Partial<MapProps> => ({
  facts,
  theme: 'dark',
  speed: VIDEO_SPEED,
  streetLabels: false,
  padding: videoPaddingOf(size),
});

/**
 * The site's address as a video says it: without its scheme or its last slash.
 *
 * @param url - The address (`https://example.org/railtime/`).
 * @returns As written (`example.org/railtime`).
 */
export const spokenAddress = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
