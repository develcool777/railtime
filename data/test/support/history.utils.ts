import type { Network } from '@railtime/schema/network.types';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildNetworkSnapshot } from '../../../packages/renderer/src/layers/networkSnapshot.utils';
import { emptyDrawing } from '../../../packages/renderer/src/steps/stepAnimation.utils';
import { playbackOf, renderStateOf } from '../../../packages/renderer/test/support/playback.utils';

/**
 * A city's dataset, as the app serves it.
 *
 * @param city - The city's folder in `data/`.
 * @returns The network.
 */
export const cityNetwork = (city: string): Network => JSON.parse(readFileSync(fileURLToPath(new URL(`../../${city}/${city}.json`, import.meta.url)), 'utf8'));

/** What playing a whole history at 1× did. */
export type PlayedHistory = {
  steps: number;
  started: number;
  cursor: number;
  mostHighlighted: number;
  /** Seconds at 1×. */
  seconds: number;
};

/**
 * Plays a network's whole history at 1×, drawing every fifth frame of each step as the map would.
 *
 * @param network - The network.
 * @returns How it went.
 */
export const playWholeHistory = (network: Network): PlayedHistory => {
  const playback = playbackOf(network);
  const { timeline, player } = playback;
  player.seek(timeline.start);
  player.playing = true;
  const frameSeconds = 1 / 20;
  let seconds = 0;
  let started = 0;
  let mostHighlighted = 0;
  let frame = 0;
  while (player.playing && seconds < 7200) {
    started += player.tick(frameSeconds).filter(event => event.type === 'stepStart').length;
    seconds += frameSeconds;
    frame += 1;
    if (frame % 5 !== 0 || !player.active || player.phase === 'pre') continue;
    const state = renderStateOf(playback);
    const drawing = emptyDrawing();
    player.active.animation.draw({ state, snapshot: buildNetworkSnapshot(state, true), progress: player.progress, holdProgress: player.holdProgress }, drawing);
    mostHighlighted = Math.max(mostHighlighted, drawing.highlighted.size);
  }
  return { steps: timeline.steps.length, started, cursor: player.cursor, mostHighlighted, seconds };
};
