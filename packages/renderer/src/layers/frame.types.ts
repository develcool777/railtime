import type { NetworkEngine } from '@railtime/network/engine.service';
import type { LineId } from '@railtime/schema/network.types';
import type { ActiveStepLayer, NetworkLayer } from './network.service';
import type { StationLayer } from './stations.service';
import type { Minimap } from '../minimap/minimap.service';
import type { Player } from '../playback/player.service';
import type { ChaseTarget } from '../steps/animation.types';

/** What draws each frame: the network, its history and the player, and the layers drawn on. */
export type FrameParts = {
  index: NetworkEngine['index'];
  timeline: NetworkEngine['timeline'];
  /** Where in the history the map can be: whether the player's playhead is today's, or where the map rests. */
  playheads: NetworkEngine['playheads'];
  player: Player;
  network: NetworkLayer;
  activeStep: ActiveStepLayer;
  stations: StationLayer;
  /** The overview inset, if there is one: it shows the network and the change playing. */
  minimap: Pick<Minimap, 'setNetwork' | 'setActive'> | null;
  /** A line's own colour in the current theme. */
  baseColor: (line: LineId) => string;
};

/** What a frame drew that the map tells the app. */
export type FrameOutcome = {
  /** How many of the playing step's new stations have appeared, when that changed; else `null`. */
  revealed: number | null;
  /** The selected station is not on the map this frame: gone, or not yet open. */
  selectionGone: boolean;
  /** Where a camera following the playing step's line looks from, and which way; `null` when nothing grows. */
  chase: ChaseTarget | null;
};
