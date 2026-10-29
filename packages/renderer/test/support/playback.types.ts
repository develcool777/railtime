import type { NetworkIndex } from '../../src/model/networkIndex.service';
import type { Timeline } from '../../src/model/timeline.service';
import type { Player } from '../../src/playback/player.service';

/** A network's index, timeline and player, wired as the map wires them. */
export type Playback = { index: NetworkIndex; timeline: Timeline; player: Player };
