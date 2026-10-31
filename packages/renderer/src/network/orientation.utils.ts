import { required } from '../core/required.utils';
import type { TrackSegment, Travel } from './index.types';
import type { Chain } from './orientation.types';

/**
 * Groups things by each station they touch.
 *
 * @param things - Segments or chains.
 * @param stationsOf - The stations a thing touches.
 * @returns Station id to the things touching it.
 */
const groupByStation = <Thing>(things: Thing[], stationsOf: (thing: Thing) => string[]): Map<string, Thing[]> => {
  const byStation = new Map<string, Thing[]>();
  for (const thing of things)
    for (const station of stationsOf(thing)) {
      const group = byStation.get(station) ?? [];
      group.push(thing);
      byStation.set(station, group);
    }
  return byStation;
};

/**
 * Walks away from a segment through plain stations (exactly two segments meet), collecting segments.
 *
 * @param first - The segment the walk leaves.
 * @param station - The station it leaves through.
 * @param segmentsAt - Segments by station.
 * @param used - Segments already in a chain; extended with every segment walked.
 * @returns Each segment walked with the station it was entered from, and the station the walk stopped at.
 */
const walkPlainStations = (first: TrackSegment, station: string, segmentsAt: Map<string, TrackSegment[]>, used: Set<TrackSegment>) => {
  const steps: { segment: TrackSegment; enteredAt: string }[] = [];
  let previous = first;
  let current = station;
  while (segmentsAt.get(current)!.length === 2) {
    const next = segmentsAt.get(current)!.find(segment => segment !== previous)!;
    if (used.has(next)) break;
    used.add(next);
    steps.push({ segment: next, enteredAt: current });
    current = next.stationA === current ? next.stationB : next.stationA;
    previous = next;
  }
  return { steps, stoppedAt: current };
};

/**
 * Cuts the track into chains: runs between junctions. A ring with no junction is one chain.
 *
 * @param segments - All track segments.
 * @param segmentsAt - Segments by station.
 * @returns The chains, each with its segments in order of travel from `start` to `end`.
 */
const buildChains = (segments: TrackSegment[], segmentsAt: Map<string, TrackSegment[]>): Chain[] => {
  const used = new Set<TrackSegment>();
  const chains: Chain[] = [];
  for (const seed of segments) {
    if (used.has(seed)) continue;
    used.add(seed);
    const ahead = walkPlainStations(seed, seed.stationB, segmentsAt, used);
    const behind = walkPlainStations(seed, seed.stationA, segmentsAt, used);
    chains.push({
      // From the far end behind, through the seed (A→B), to the far end ahead.
      segments: [
        ...behind.steps.reverse().map(step => ({ segment: step.segment, travel: (step.segment.stationB === step.enteredAt ? 1 : -1) as Travel })),
        { segment: seed, travel: 1 as Travel },
        ...ahead.steps.map(step => ({ segment: step.segment, travel: (step.segment.stationA === step.enteredAt ? 1 : -1) as Travel })),
      ],
      start: behind.stoppedAt,
      end: ahead.stoppedAt,
    });
  }
  return chains;
};

/**
 * Whether a chain, travelled from its start to its end, heads east.
 *
 * @param chain - The chain.
 * @returns True if it ends east of where it starts.
 */
const headsEast = (chain: Chain): boolean => {
  const first = required(chain.segments[0], 'segment of a chain');
  const last = required(chain.segments.at(-1), 'segment of a chain');
  const start = (first.travel === 1 ? first.segment.coordinates : first.segment.reversedCoordinates)[0];
  const end = (last.travel === 1 ? last.segment.reversedCoordinates : last.segment.coordinates)[0];
  return (end?.[0] ?? 0) >= (start?.[0] ?? 0);
};

/**
 * Picks each chain's direction (1 = start→end) so that, where it can, a chain starts where its neighbour ends.
 *
 * @param chains - The chains.
 * @returns Each chain's direction.
 */
const alignChains = (chains: Chain[]): Map<Chain, Travel> => {
  const chainsAt = groupByStation(chains, chain => [chain.start, chain.end]);
  const direction = new Map<Chain, Travel>();
  const queue: Chain[] = [];
  const visit = (chain: Chain, travel: Travel) => {
    if (direction.has(chain)) return;
    direction.set(chain, travel);
    queue.push(chain);
  };
  for (const seed of chains) {
    // Each separate piece of network starts out heading east, so its sides read naturally.
    visit(seed, headsEast(seed) ? 1 : -1);
    while (queue.length > 0) {
      const chain = queue.shift()!;
      const [start, end] = direction.get(chain) === 1 ? [chain.start, chain.end] : [chain.end, chain.start];
      for (const next of chainsAt.get(end)!) visit(next, next.start === end ? 1 : -1);
      for (const previous of chainsAt.get(start)!) visit(previous, previous.end === start ? 1 : -1);
    }
  }
  return direction;
};

/**
 * Gives every segment a direction of travel so that segments continue one another: one ends where
 * the next starts.
 *
 * MapLibre's `line-offset` is relative to the direction a line's points run. Segments store their
 * points in an arbitrary order (by station id), so without this two lines sharing a corridor would
 * swap sides wherever the stored order happens to flip.
 *
 * The track is cut into chains (runs between junctions) and each chain is oriented as a whole, so
 * the direction never flips inside one. Chains are then lined up across junctions where they can be;
 * the network has loops, so not every junction can agree, but a junction is where the set of lines on
 * the track changes anyway.
 *
 * @param segments - All track segments.
 * @returns Each segment's direction of travel.
 */
export const orientSegments = (segments: TrackSegment[]): Map<TrackSegment, Travel> => {
  const chains = buildChains(
    segments,
    groupByStation(segments, segment => [segment.stationA, segment.stationB]),
  );
  const chainDirection = alignChains(chains);
  const travel = new Map<TrackSegment, Travel>();
  for (const chain of chains) for (const step of chain.segments) travel.set(step.segment, (step.travel * chainDirection.get(chain)!) as Travel);
  return travel;
};
