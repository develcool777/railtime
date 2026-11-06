import { toTimestamp } from '@railtime/core/date.utils';
import type { Network } from '@railtime/schema/network.types';
import { playbackOf, renderStateOf } from './playback.utils';
import type { FrameOptions, StartedStep } from './stepFrames.types';
import { buildNetworkSnapshot } from '../../src/layers/snapshot.utils';
import { emptyDrawing } from '../../src/steps/animation.utils';

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
  playback.player.seek(playback.facts.playheads.on(toTimestamp(date)));
  playback.player.skip();
  const active = playback.player.active;
  if (!active) throw new Error(`No step after ${date}`);
  const { animation } = active;
  const state = renderStateOf(playback);
  const draw = (progress: number, { holdProgress = 0 }: FrameOptions = {}) => {
    const drawing = emptyDrawing();
    const drawn = { ...state, base: animation.baseAt('draw', progress) };
    animation.draw({ state: drawn, snapshot: buildNetworkSnapshot(drawn), progress, holdProgress }, drawing);
    return drawing;
  };
  return { playback, animation, state, draw };
};
