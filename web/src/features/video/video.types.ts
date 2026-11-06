import type { NetworkFacts } from '@railtime/network/facts.service';
import type { PlanInfo } from '@railtime/network/facts.types';
import type { ViewMode } from '@railtime/renderer/transitMap.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { Network } from '@railtime/schema/network.types';

/**
 * What a moment of the video is: loading its map, ready to start, its title, the history playing; the
 * whole network; its numbers round it; the plan playing, if it has one; its end card, then over.
 */
export type VideoScene = 'loading' | 'ready' | 'title' | 'history' | 'insights' | 'plan' | 'overview' | 'end' | 'done';

/** How the map is seen in a beat: as asked, following what plays; flat, the whole network; or flat between the panels, its coverage drawn. */
export type VideoFraming = 'playing' | 'whole' | 'insights';

/** One beat of a video's script: its scene, the plan laid on the network, and how the map is seen. */
export type VideoBeat = { scene: VideoScene; plan: PlanInfo | null; framing: VideoFraming };

/** The video's size, pixels: what the camera keeps room in. */
export type VideoSize = { width: number; height: number };

/** Room the video keeps clear at the map's edges, for what lies over it, pixels. */
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
export type VideoLayers = { title: number; planIntro: number; minimap: number; year: number; caption: number; end: number };

/** What a video opens with: the city's network, the frame's size, how the map is seen, where its outline is served, and the plan its address names. */
export type VideoOpening = {
  network: Network;
  size: VideoSize;
  viewMode: ViewMode;
  outline: string;
  /** The plan the address names, to play and end on if the network has it; `null` for none. */
  plan: string | null;
};

/** What the map is given in a video: the network shown, at the frame's size, seen as the beat asks. */
export type VideoMapInput = {
  /** The network shown: the city's today, or with the plan playing. */
  facts: NetworkFacts;
  size: VideoSize;
  /** How the video was asked to be seen, while it plays. */
  viewMode: ViewMode;
  framing: VideoFraming;
  /** The city's outline, coverage's; `null` for none (yet). */
  boundary: CityBoundary | null;
};
