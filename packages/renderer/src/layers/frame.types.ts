import type { NetworkEngine } from '@railtime/network/engine.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { LineId } from '@railtime/schema/network.types';
import type { ActiveStepLayer, NetworkLayer } from './network.service';
import type { MoverKind } from './stack.types';
import type { StationLayer } from './stations.service';
import type { Minimap } from '../minimap/minimap.service';
import type { MotionLayer } from '../motion/motion.service';
import type { Player } from '../playback/player.service';
import type { ChaseTarget } from '../steps/animation.types';

/** What draws each frame: the network, its history and the player, and the layers drawn on. */
export type FrameParts = {
  index: NetworkEngine['index'];
  timeline: NetworkEngine['timeline'];
  /** The network's facts, which say what the `time` event tells of a playhead. */
  facts: NetworkFacts;
  player: Player;
  network: NetworkLayer;
  activeStep: ActiveStepLayer;
  stations: StationLayer;
  /** What moves on the map every frame. */
  motion: MotionLayer<MoverKind>;
  /** The trains the network runs at a moment. */
  trainService: NetworkEngine['trainService'];
  /** Whether trains are to run. */
  showTrains: () => boolean;
  /** The overview inset, if there is one: it shows the network and the change playing. */
  minimap: Pick<Minimap, 'setNetwork' | 'setActive' | 'flush'> | null;
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
  /** The network on the map was built again: its lines may be drawn as others now. */
  refreshed: boolean;
};
