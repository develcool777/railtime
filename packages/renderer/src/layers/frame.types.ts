import type { LngLat } from '@railtime/schema/network.types';
import type { Minimap } from '../minimap/map.service';
import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';
import type { Player } from '../playback/player.service';
import type { StationLayer } from '../stations/layer.service';
import type { ActiveStepLayer } from './activeStep.service';
import type { NetworkLayer } from './network.service';

/** What draws each frame: the network, its history and the player, and the layers drawn on. */
export type FrameParts = {
  index: NetworkIndex;
  timeline: Timeline;
  player: Player;
  network: NetworkLayer;
  activeStep: ActiveStepLayer;
  stations: StationLayer;
  /** The overview inset, if there is one: it shows the network and the change playing. */
  minimap: Pick<Minimap, 'setLines' | 'setActive'> | null;
  /** A line's own colour in the current theme. */
  baseColor: (line: string) => string;
};

/** What a frame drew that the map tells the app. */
export type FrameOutcome = {
  /** How many of the playing step's new stations have appeared, when that changed; else `null`. */
  revealed: number | null;
  /** The selected station is not on the map this frame: gone, or not yet open. */
  selectionGone: boolean;
  /** Where the playing step's line is growing this frame: its tips; none when nothing grows. */
  tips: LngLat[];
};
