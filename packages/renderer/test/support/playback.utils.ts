import { NetworkFacts } from '@railtime/network/facts.service';
import type { FactsAt } from '@railtime/network/facts.types';
import type { Network } from '@railtime/schema/network.types';
import type { Playback, PlaybackOptions } from './playback.types';
import type { NetworkSnapshot } from '../../src/layers/snapshot.types';
import { buildNetworkSnapshot } from '../../src/layers/snapshot.utils';
import type { RenderState } from '../../src/layers/style.types';
import { Player } from '../../src/playback/player.service';
import { StepAnimation } from '../../src/steps/animation.service';
import type { StepDrawing } from '../../src/steps/animation.types';
import { emptyDrawing } from '../../src/steps/animation.utils';

/**
 * A network's facts, its index and timeline, and a player at today, 1 January 2026, wired as `TransitMap` wires them.
 *
 * @param network - The network.
 * @param options - What the playback is of.
 * @param options.plan - One of its plans to build on it, as `TransitMap`'s `plan` option does.
 * @param options.hidden - Its lines hidden, as the facts `TransitMap` is given are made: those hidden at first without them.
 * @param options.view - How the map is seen as the steps play: flat unless told.
 * @returns The pieces.
 */
export const playbackOf = (network: Network, { plan, hidden, view = '2d' }: PlaybackOptions = {}): Playback => {
  const facts = NetworkFacts.create(network, { plan, ...(hidden && { hidden }), today: Date.UTC(2026, 0, 1) });
  const { index, timeline } = facts.engine;
  const player = new Player(facts.engine, step => new StepAnimation(step, { index, timeline, view }));
  return { facts, index, timeline, player };
};

/**
 * The network at the player's moment: as the app asks of it.
 *
 * @param playback - The pieces from `playbackOf`.
 * @returns The questions, answered for that moment.
 */
export const networkNow = (playback: Playback): FactsAt => playback.facts.asOf(playback.player.playhead);

/**
 * The render state at the player's position, in each line's own colour.
 *
 * @param playback - The pieces from `playbackOf`.
 * @returns The render state.
 */
export const renderStateOf = (playback: Playback): RenderState => ({
  index: playback.index,
  timeline: playback.timeline,
  cursor: playback.player.cursor,
  identityProgress: null,
  baseColor: line => playback.index.lineOf(line).color,
});

/**
 * What the map has on it at the player's position.
 *
 * @param playback - The pieces from `playbackOf`.
 * @param stepPlaying - A step is playing there: its openings make room, its closures fade.
 * @returns The snapshot.
 */
export const snapshotOf = (playback: Playback, stepPlaying = false): NetworkSnapshot => buildNetworkSnapshot(renderStateOf(playback), stepPlaying);

/**
 * Draws the step playing, at the player's progress through it, as the map would.
 *
 * @param playback - The pieces from `playbackOf`.
 * @returns What the step drew, or `null` if none is playing.
 */
export const drawnStep = (playback: Playback): StepDrawing | null => {
  const { player } = playback;
  if (!player.active) return null;
  const state = renderStateOf(playback);
  const drawing = emptyDrawing();
  player.active.animation.draw({ state, snapshot: buildNetworkSnapshot(state, true), progress: player.progress, holdProgress: player.holdProgress }, drawing);
  return drawing;
};
