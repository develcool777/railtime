import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { RenderState } from '../../src/layers/lineStyle.types';
import { NetworkIndex } from '../../src/model/networkIndex.service';
import { Timeline } from '../../src/model/timeline.service';
import { Player } from '../../src/playback/player.service';
import { createStepAnimation } from '../../src/steps/stepAnimation.utils';
import type { Playback } from './playback.types';

/**
 * A network with its index, timeline and a player at today, 1 January 2026, wired as `TransitMap` wires them.
 *
 * @param network - The network.
 * @param plan - One of its plans to build on it, as `TransitMap`'s `plan` option does.
 * @returns The pieces.
 */
export const playbackOf = (network: Network, plan?: string): Playback => {
  const built = plan ? buildPlan(network, plan) : null;
  const index = new NetworkIndex(built?.network ?? network, built?.sections);
  const timeline = new Timeline(index);
  const player = new Player(timeline, Date.UTC(2026, 0, 1), step =>
    createStepAnimation(step, { index, timeline, stationsBefore: timeline.stationsOnMap(step.index) }),
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
