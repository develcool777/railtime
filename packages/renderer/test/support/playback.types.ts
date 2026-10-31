import type { NetworkModel } from '@railtime/network/model.service';
import type { NetworkIndex } from '@railtime/network/index.service';
import type { Timeline } from '@railtime/network/timeline.service';
import type { Player } from '../../src/playback/player.service';

/** A network's model, its index and timeline, and a player, wired as the map wires them. */
export type Playback = { model: NetworkModel; index: NetworkIndex; timeline: Timeline; player: Player };
