import type { NetworkEngine } from '@railtime/network/engine.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Player } from '../../src/playback/player.service';

/** A network's facts, its index and timeline, and a player, wired as the map wires them. */
export type Playback = { facts: NetworkFacts; index: NetworkEngine['index']; timeline: NetworkEngine['timeline']; player: Player };
