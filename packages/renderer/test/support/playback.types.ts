import type { NetworkModel } from '../../src/model/network.service';
import type { NetworkIndex } from '../../src/network/index.service';
import type { Timeline } from '../../src/network/timeline.service';
import type { Player } from '../../src/playback/player.service';

/** A network's model, its index and timeline, and a player, wired as the map wires them. */
export type Playback = { model: NetworkModel; index: NetworkIndex; timeline: Timeline; player: Player };
