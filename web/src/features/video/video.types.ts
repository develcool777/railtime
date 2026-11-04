import type { ViewMode } from '@railtime/renderer/transitMap.types';
import type { Network } from '@railtime/schema/network.types';

/**
 * Where the video is: loading its map, ready to start, its title, the history playing, its end card,
 * then over.
 */
export type VideoScene = 'loading' | 'ready' | 'title' | 'history' | 'end' | 'done';

/** The video's size, pixels: what the camera keeps room in. */
export type VideoSize = { width: number; height: number };

/** Room the video keeps clear at the map's edges, for its title, year and caption, pixels. */
export type VideoPadding = { top: number; bottom: number; left: number; right: number };

/** Where the video is, as each frame shows it: what `videoLayersOf` works out what shows from. */
export type VideoMoment = {
  scene: VideoScene;
  /** How long the scene has shown, ms. */
  elapsed: number;
  /** How long since the change captioned was shown, ms. */
  sinceCaption: number;
  /** How long since its caption went, ms, or `null` while it shows. */
  sinceCaptionGone: number | null;
};

/** How much of each piece over the map shows, 0 to 1. */
export type VideoLayers = { title: number; year: number; caption: number; end: number };

/** What a video opens with: the city's network, the frame's size, and how the map is seen. */
export type VideoOpening = { network: Network; size: VideoSize; viewMode: ViewMode };
