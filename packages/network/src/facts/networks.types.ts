import type { LineId, Network } from '@railtime/schema/network.types';
import type { LineGap } from '../engine/engine.types';

/** The network with some lines hidden, and the stretches of time each line left is out with them: what the engine is made from. */
export type ShownNetwork = {
  network: Network;
  /** The years each line was drawn as a line hidden (an alias), by line. */
  gaps: Map<LineId, LineGap[]>;
};
