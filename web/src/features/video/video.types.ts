import type { NetworkFacts } from '@railtime/network/facts.service';
import type { ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';

/**
 * Where the video is: loading its map, ready to start, its title, the history playing; then for each
 * plan going ahead its card and the plan playing; the whole network from above, its coverage drawn;
 * its end card, then over.
 */
export type VideoScene = 'loading' | 'ready' | 'title' | 'history' | 'planTitle' | 'plan' | 'overview' | 'end' | 'done';

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
export type VideoLayers = { title: number; plan: number; year: number; caption: number; end: number };

/** What a video opens with: the city's network, the frame's size, how the map is seen, and where its outline is served. */
export type VideoOpening = { network: Network; size: VideoSize; viewMode: ViewMode; outline: string };

/** What the map is given in a video: the network shown, at the frame's size, seen as the scene asks. */
export type VideoMapInput = {
  /** The network shown: the city's today, or with the plan playing. */
  facts: NetworkFacts;
  size: VideoSize;
  /** How the video was asked to be seen, until the overview, which is flat. */
  viewMode: ViewMode;
  /** From above, the whole network and its coverage in view. */
  overview: boolean;
  /** The city's outline, coverage's; `null` for none (yet). */
  boundary: CityBoundary | null;
};

/** A scene that moves on by itself once it has shown so long, and the scene it moves on to. */
export type TimedScene = { ms: number; next: VideoScene };
