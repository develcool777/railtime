import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead } from '@railtime/network/facts.types';
import type { MapProps, TimeState } from './transitMap.types';

/**
 * Where a network's map stands as it is given the network.
 *
 * @param playheads - The network's playheads.
 * @param arrival - The `arrival` prop.
 * @returns The playhead: the moment asked for on this network, or where it rests.
 */
export const arrivalPlayhead = (playheads: NetworkFacts['playheads'], arrival: MapProps['arrival']): Playhead =>
  arrival ? playheads.atMoment(arrival) : playheads.rest();

/**
 * What the `time` event says of a playhead, the one way it is said.
 *
 * @param facts - The network.
 * @param playhead - Where the map is.
 * @param motion - How the map stands there.
 * @param motion.inPlan - It shows a plan.
 * @param motion.playing - It plays.
 * @returns The time state: the network's size there as the facts count it.
 */
export const timeStateOf = (facts: NetworkFacts, playhead: Playhead, motion: Pick<TimeState, 'inPlan' | 'playing'>): TimeState => ({
  ...playhead,
  atToday: facts.playheads.isToday(playhead),
  atRest: facts.playheads.isRest(playhead),
  ...motion,
  stats: facts.asOf(playhead).stats(),
});

/**
 * What a map given a network will say of it on its next frame: for an app to read the new network from
 * the moment it gives it, never the old one's cursor against the new one's facts.
 *
 * @param facts - The network.
 * @param arrival - The `arrival` prop given with it.
 * @returns Its time state, paused, as a map given a network is.
 */
export const arrivalTimeOf = (facts: NetworkFacts, arrival: MapProps['arrival']): TimeState => {
  const playhead = arrivalPlayhead(facts.playheads, arrival);
  return timeStateOf(facts, playhead, { inPlan: facts.playheads.inPlan(playhead), playing: false });
};
