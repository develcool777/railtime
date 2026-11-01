import { emptyCollection } from '../layers/snapshot.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { sliceAlong } from '@railtime/core/geometry.utils';
import { clamp } from '@railtime/core/number.utils';
import type { Growth, LineSegment, SegmentPlan } from '@railtime/network/engine.types';
import { pushTo } from '@railtime/core/collection.utils';
import { CHASE_AHEAD_KM, CHASE_BEHIND_KM, CHASE_SMOOTHING_KM } from './animation.constants';
import type { ChaseTarget, GrowthMove, GrowthPace, StepDrawing, Stretch } from './animation.types';

/**
 * A drawing with nothing in it, for a frame to fill.
 *
 * @returns An empty step drawing.
 */
export const emptyDrawing = (): StepDrawing => ({
  lines: emptyCollection(),
  growing: emptyCollection(),
  highlight: 0,
  heads: emptyCollection(),
  reached: new Map(),
  highlighted: new Set(),
  fading: new Map(),
  renamed: new Map(),
  links: emptyCollection(),
  linked: new Set(),
  chase: null,
});

/**
 * How long one run between stops takes, as a train runs it: speeding up to the pace, running at it,
 * braking to a stop; a run too short to reach the pace speeds up and brakes, no more.
 *
 * @param km - The run's length.
 * @param pace - The pace, and how long speeding up from a stop takes.
 * @returns Seconds at 1×.
 */
const runSeconds = (km: number, pace: GrowthPace): number => {
  const rampKm = (pace.kmPerSecond * pace.rampSeconds) / 2;
  if (km >= 2 * rampKm) return km / pace.kmPerSecond + pace.rampSeconds;
  return 2 * Math.sqrt((km * pace.rampSeconds) / pace.kmPerSecond);
};

/**
 * How far along a run the front is some seconds after it left its stop.
 *
 * @param seconds - Seconds at 1× since it left.
 * @param km - The run's length.
 * @param pace - The pace, and how long speeding up takes.
 * @returns Km from the stop, 0..`km`.
 */
const alongRun = (seconds: number, km: number, pace: GrowthPace): number => {
  const total = runSeconds(km, pace);
  const time = clamp(seconds, 0, total);
  const acceleration = pace.kmPerSecond / pace.rampSeconds;
  const ramp = Math.min(pace.rampSeconds, total / 2);
  if (time < ramp) return (acceleration * time * time) / 2;
  if (time > total - ramp) return km - (acceleration * (total - time) ** 2) / 2;
  return (acceleration * ramp * ramp) / 2 + pace.kmPerSecond * (time - ramp);
};

/**
 * A stretch's growth as runs: to each new station, where the front stops, then on to its end, if
 * it goes past the last.
 *
 * @param stops - Where along the stretch each new station is, km, in order.
 * @param totalKm - The stretch's length.
 * @returns The runs, in order.
 */
const movesOf = (stops: number[], totalKm: number): GrowthMove[] => {
  const moves: GrowthMove[] = [];
  let fromKm = 0;
  for (const stop of stops) {
    moves.push({ fromKm, km: Math.max(0, stop - fromKm), stops: true });
    fromKm = Math.max(fromKm, stop);
  }
  if (totalKm > fromKm + 1e-9) moves.push({ fromKm, km: totalKm - fromKm, stops: false });
  return moves;
};

/**
 * How long a stretch takes to grow: each run to the next stop, as a train runs it, and a stop at each
 * new station. Its length and its stations decide it, at one pace, never squeezed or stretched.
 *
 * @param stops - Where along the stretch each new station is, km, in order.
 * @param totalKm - The stretch's length.
 * @param pace - The pace.
 * @returns Seconds at 1×.
 */
export const growthSeconds = (stops: number[], totalKm: number, pace: GrowthPace): number =>
  movesOf(stops, totalKm).reduce((total, move) => total + runSeconds(move.km, pace) + (move.stops ? pace.stationSeconds : 0), 0);

/**
 * When the front gets to each stop, where it then waits `stationSeconds`.
 *
 * @param stops - Where along the stretch each stop is, km, in order.
 * @param totalKm - The stretch's length.
 * @param pace - The pace.
 * @returns Seconds at 1× from the start, one for each stop.
 */
export const arrivalSeconds = (stops: number[], totalKm: number, pace: GrowthPace): number[] => {
  const arrivals: number[] = [];
  let seconds = 0;
  for (const move of movesOf(stops, totalKm)) {
    seconds += runSeconds(move.km, pace);
    if (!move.stops) continue;
    arrivals.push(seconds);
    seconds += pace.stationSeconds;
  }
  return arrivals;
};

/**
 * How far a stretch's growth front has got: speeding up out of each stop, at the pace between,
 * braking into the next new station, where it waits; so every stretch, long or short, moves alike.
 *
 * @param seconds - Seconds at 1× since the stretch began to grow.
 * @param stops - Where along the stretch each new station is, km, in order.
 * @param totalKm - The stretch's length.
 * @param pace - The pace.
 * @returns The front's distance along the stretch, km.
 */
export const frontKmAt = (seconds: number, stops: number[], totalKm: number, pace: GrowthPace): number => {
  let left = seconds;
  for (const move of movesOf(stops, totalKm)) {
    const running = runSeconds(move.km, pace);
    if (left <= running) return move.fromKm + alongRun(left, move.km, pace);
    left -= running + (move.stops ? pace.stationSeconds : 0);
    if (left <= 0) return move.fromKm + move.km;
  }
  return totalKm;
};

/**
 * Where a segment's growth starts and ends: the station it grows from, and the other.
 *
 * @param plan - The segment's plan.
 * @returns Its first and last station.
 */
const endsOf = (plan: SegmentPlan): [string, string] =>
  plan.fromStationA ? [plan.segment.stationA, plan.segment.stationB] : [plan.segment.stationB, plan.segment.stationA];

/**
 * The one way through a stretch a camera follows: from where it starts growing, segment after
 * segment, each starting where the one before ended, as long a way as there is. A branch off it
 * grows on screen; the camera keeps to this.
 *
 * @param plans - The stretch's segments, as they grow.
 * @returns The segments of the way, in order.
 */
export const mainPathOf = (plans: SegmentPlan[]): SegmentPlan[] => {
  const first = plans.reduce<SegmentPlan | null>((earliest, plan) => (!earliest || plan.startKm < earliest.startKm ? plan : earliest), null);
  if (!first) return [];
  const path = [first];
  // The longest segment going on from where one ends; never one already on the way.
  const after = (plan: SegmentPlan) =>
    plans
      .filter(other => !path.includes(other) && endsOf(other)[0] === endsOf(plan)[1] && Math.abs(other.startKm - plan.startKm - plan.segment.lengthKm) < 1e-6)
      .sort((one, other) => other.segment.lengthKm - one.segment.lengthKm)[0];
  let next = after(first);
  while (next) {
    path.push(next);
    next = after(next);
  }
  return path;
};

/**
 * A point some way along a path, at either end beyond it.
 *
 * @param path - The path's segments, in order.
 * @param km - How far along, from where the path starts.
 * @returns The point.
 */
export const pointAlong = (path: SegmentPlan[], km: number): LngLat => {
  const startKm = path[0]?.startKm ?? 0;
  for (const [position, plan] of path.entries()) {
    const along = km + startKm - plan.startKm;
    if (along > plan.segment.lengthKm && position < path.length - 1) continue;
    const { segment } = plan;
    const sliced = plan.fromStationA
      ? sliceAlong(segment.coordinates, segment.distances, clamp(along, 0, segment.lengthKm))
      : sliceAlong(segment.reversedCoordinates, segment.reversedDistances, clamp(along, 0, segment.lengthKm));
    return sliced.at(-1) ?? segment.coordinates[0]!;
  }
  return [0, 0];
};

/**
 * Where a camera following a front looks from, and which way: the line's middle over a short
 * stretch round the front, so a sharp bend is rounded, not turned on the spot; and the way from a
 * little behind the front to a little ahead of it, so the camera starts turning before the bend.
 * At the path's ends the stretch shrinks to the front itself.
 *
 * @param path - The way the camera follows (`mainPathOf`).
 * @param frontKm - How far along it the front is, from the stretch's start.
 * @param backwards - The front runs back towards the start, as a closed stretch retracts.
 * @returns The point and the way.
 */
export const chaseAlong = (path: SegmentPlan[], frontKm: number, backwards = false): ChaseTarget => {
  const first = path[0];
  const last = path.at(-1);
  const lengthKm = first && last ? last.startKm + last.segment.lengthKm - first.startKm : 0;
  const km = clamp(frontKm - (first?.startKm ?? 0), 0, lengthKm);
  const reach = Math.min(CHASE_SMOOTHING_KM, km, lengthKm - km);
  const samples = [-1, -0.5, 0, 0.5, 1].map(share => pointAlong(path, km + share * reach));
  const center: LngLat = [
    samples.reduce((sum, point) => sum + point[0], 0) / samples.length,
    samples.reduce((sum, point) => sum + point[1], 0) / samples.length,
  ];
  const direction = backwards ? -1 : 1;
  const along = (offsetKm: number) => pointAlong(path, clamp(km + offsetKm * direction, 0, lengthKm));
  return { center, behind: along(-CHASE_BEHIND_KM), ahead: along(CHASE_AHEAD_KM) };
};

/**
 * A stretch an opening grows or a closure retracts: where its front stops (each station it opens, or
 * takes off the map), the way a camera follows, and its lines by segment and station. A retreat runs
 * its growth backwards, so its stops count from the far end.
 *
 * @param growth - How the stretch grows (`growthOf`), or would from the network that stays (`retreatOf`).
 * @param lineSegments - Its lines' segments.
 * @param retracts - It is a closure's.
 * @returns The stretch.
 */
export const stretchOf = (growth: Growth, lineSegments: LineSegment[], retracts: boolean): Stretch => {
  const linesBySegment = new Map<number, string[]>();
  const linesByStation = new Map<string, string[]>();
  for (const { segment, line } of lineSegments) {
    pushTo(linesBySegment, segment.index, line);
    for (const station of [segment.stationA, segment.stationB]) pushTo(linesByStation, station, line);
  }
  const stops = growth.reach.filter(reached => reached.isNew).map(reached => reached.km);
  return {
    growth,
    stops: retracts ? stops.map(km => growth.totalKm - km).reverse() : stops,
    path: mainPathOf(growth.plans),
    linesBySegment,
    linesByStation,
    retracts,
  };
};
