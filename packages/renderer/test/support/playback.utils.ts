import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { RenderState } from '../../src/layers/lineStyle.types';
import { NetworkIndex } from '../../src/network/index.service';
import { Timeline } from '../../src/network/timeline.service';
import { Player } from '../../src/playback/player.service';
import { createStepAnimation } from '../../src/steps/animation.utils';
import type { ViewMode } from '../../src/transitMap.types';
import type { Playback } from './playback.types';

/**
 * A network with its index, timeline and a player at today, 1 January 2026, wired as `TransitMap` wires them.
 *
 * @param network - The network.
 * @param plan - One of its plans to build on it, as `TransitMap`'s `plan` option does.
 * @param view - How the map is seen as the steps play: flat unless told.
 * @returns The pieces.
 */
export const playbackOf = (network: Network, plan?: string, view: ViewMode = '2d'): Playback => {
  const built = plan ? buildPlan(network, plan) : null;
  const index = new NetworkIndex(built?.network ?? network, built?.sections);
  const timeline = new Timeline(index);
  const player = new Player(timeline, Date.UTC(2026, 0, 1), step =>
    createStepAnimation(step, { index, timeline, stationsBefore: timeline.stationsOnMap(step.index), view }),
  );
  return { index, timeline, player };
};

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
