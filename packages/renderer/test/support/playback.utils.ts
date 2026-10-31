import type { Network } from '@railtime/schema/network.types';
import type { RenderState } from '../../src/layers/lineStyle.types';
import { NetworkFacts } from '@railtime/network/facts.service';
import type { FactsAt } from '@railtime/network/facts.types';
import { Player } from '../../src/playback/player.service';
import { createStepAnimation } from '../../src/steps/animation.utils';
import type { ViewMode } from '../../src/transitMap.types';
import type { Playback } from './playback.types';

/**
 * A network's facts, its index and timeline, and a player at today, 1 January 2026, wired as `TransitMap` wires them.
 *
 * @param network - The network.
 * @param plan - One of its plans to build on it, as `TransitMap`'s `plan` option does.
 * @param view - How the map is seen as the steps play: flat unless told.
 * @returns The pieces.
 */
export const playbackOf = (network: Network, plan?: string, view: ViewMode = '2d'): Playback => {
  const facts = NetworkFacts.create(network, { ...(plan ? { plan } : {}), today: Date.UTC(2026, 0, 1) });
  const { index, timeline } = facts.engine;
  const player = new Player(facts.engine, step => createStepAnimation(step, { index, timeline, view }));
  return { facts, index, timeline, player };
};

/**
 * The network at the player's moment: as the app asks of it.
 *
 * @param playback - The pieces from `playbackOf`.
 * @returns The questions, answered for that moment.
 */
export const networkNow = (playback: Playback): FactsAt => playback.facts.asOf({ cursor: playback.player.cursor, time: playback.player.clock });

/**
 * The render state at the player's position, every line visible, in each line's own colour.
 *
 * @param playback - The pieces from `playbackOf`.
 * @returns The render state.
 */
export const renderStateOf = (playback: Playback): RenderState => ({
  index: playback.index,
  timeline: playback.timeline,
  cursor: playback.player.cursor,
  identityProgress: null,
  visibleLines: new Set(playback.index.lineIds),
  baseColor: line => playback.index.lineOf(line).color,
});
