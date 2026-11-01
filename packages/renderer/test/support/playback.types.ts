import type { NetworkEngine } from '@railtime/network/engine.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { NetworkFactsOptions } from '@railtime/network/facts.types';
import type { Player } from '../../src/playback/player.service';
import type { ViewMode } from '../../src/transitMap.types';

/** A network's facts, its index and timeline, and a player, wired as the map wires them. */
export type Playback = { facts: NetworkFacts; index: NetworkEngine['index']; timeline: NetworkEngine['timeline']; player: Player };

/** What a playback is of: a plan built on the network and its optional networks shown, as `TransitMap` is given them, and how the map is seen. */
export type PlaybackOptions = Pick<NetworkFactsOptions, 'plan' | 'networks'> & { view?: ViewMode };
