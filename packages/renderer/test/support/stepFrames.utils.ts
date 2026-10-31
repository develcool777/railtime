import type { Network } from '@railtime/schema/network.types';
import { toTimestamp } from '../../src/core/date.utils';
import { buildNetworkSnapshot } from '../../src/layers/snapshot.utils';
import { emptyDrawing } from '../../src/steps/animation.utils';
import { playbackOf, renderStateOf } from './playback.utils';
import type { FrameOptions, StartedStep } from './stepFrames.types';

/**
 * The first step after a date, started as the player starts it, and its frames drawn as the map
 * draws them.
 *
 * @param network - The network.
 * @param date - A day before the step.
 * @returns The step's animation, the state it starts in, and a way to draw its frames.
 */
export const stepAfter = (network: Network, date: string): StartedStep => {
  const playback = playbackOf(network);
  playback.player.seek(toTimestamp(date));
  playback.player.skip();
  const active = playback.player.active;
  if (!active) throw new Error(`No step after ${date}`);
  const { animation } = active;
  const state = renderStateOf(playback);
  const draw = (progress: number, { holdProgress = 0, hidden = [] }: FrameOptions = {}) => {
    const shown = { ...state, visibleLines: new Set([...state.visibleLines].filter(line => !hidden.includes(line))) };
    const drawing = emptyDrawing();
    animation.draw({ state: shown, snapshot: buildNetworkSnapshot(shown, true), progress, holdProgress }, drawing);
    return drawing;
  };
  return { playback, animation, state, draw };
};
