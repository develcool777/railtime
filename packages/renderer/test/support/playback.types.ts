import type { NetworkFacts } from '@railtime/network/facts.service';
import type { NetworkIndex } from '@railtime/network/engine/index.service';
import type { Timeline } from '@railtime/network/engine/timeline.service';
import type { Player } from '../../src/playback/player.service';

/** A network's facts, its index and timeline, and a player, wired as the map wires them. */
export type Playback = { facts: NetworkFacts; index: NetworkIndex; timeline: Timeline; player: Player };
