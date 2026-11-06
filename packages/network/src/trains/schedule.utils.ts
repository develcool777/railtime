import { pushTo } from '@railtime/core/collection.utils';
import type { LineId } from '@railtime/schema/network.types';
import { TRAIN_FLEET, TRAIN_KM_PER_SECOND, TRAIN_LEAST_SPACING_KM, TRAIN_PHASE_STEP_SECONDS, TRAIN_STOP_SECONDS } from './trains.constants.ts';
import type { RouteTimetable, TrainPlace, TrainRun } from './trains.types';

/**
 * How long after one train the next comes along a line, worked out from the network alone: long enough
 * that all its lines, out and back, carry about a fleet of trains, and never so short they run closer
 * than a train's least spacing. So a large network runs its trains further apart than a small one.
 *
 * @param lines - Each line's routes.
 * @returns The interval, seconds.
 */
export const intervalOf = (lines: TrainRun[][]): number => {
  let lineKm = 0;
  for (const runs of lines) {
    const segments = new Map(runs.flatMap(run => run.legs.map(({ segment }) => [segment.index, segment.lengthKm] as const)));
    for (const km of segments.values()) lineKm += km;
  }
  return Math.max(TRAIN_LEAST_SPACING_KM, (lineKm * 2) / TRAIN_FLEET) / TRAIN_KM_PER_SECOND;
};

/**
 * How trains run along a route: on at an even pace, standing at each stop, and back the same way. A
 * way takes a whole number of `everySeconds`, its turn at the end included, so a train leaves each end
 * at the same moment, as on a real line; a loop's trains turn where it closes, so it runs both ways
 * round. The network keeps no timetable: this is an illustration, the same for every line.
 *
 * @param run - The route.
 * @param everySeconds - How long after one train the next comes along it.
 * @returns Its timetable, on its own clock.
 */
export const timetableOf = (run: TrainRun, everySeconds: number): RouteTimetable => {
  const times = [0];
  const kms = [0];
  let time = 0;
  let km = 0;
  const rideTo = (next: number) => {
    time += (next - km) / TRAIN_KM_PER_SECOND;
    km = next;
    times.push(time);
    kms.push(km);
  };
  for (const stop of run.stopsKm) {
    rideTo(stop);
    time += TRAIN_STOP_SECONDS;
    times.push(time);
    kms.push(km);
  }
  rideTo(run.lengthKm);
  const wayIncludingTurnSeconds = Math.max(1, Math.ceil(time / everySeconds)) * everySeconds;
  return { run, times, kms, tripSeconds: time, everySeconds, wayIncludingTurnSeconds, roundSeconds: wayIncludingTurnSeconds * 2, phaseSeconds: 0 };
};

/**
 * When a train on a route reaches a point on it, on the route's clock.
 *
 * @param timetable - The route's timetable.
 * @param km - How far along it the point is.
 * @param heading - Which way the train is heading.
 * @returns How long into its round, seconds.
 */
export const passSeconds = ({ times, kms, tripSeconds, wayIncludingTurnSeconds }: RouteTimetable, km: number, heading: 1 | -1): number => {
  if (heading === 1) {
    const reached = kms.findIndex(each => each >= km);
    return (times[reached] ?? 0) - ((kms[reached] ?? km) - km) / TRAIN_KM_PER_SECOND;
  }
  const left = kms.findLastIndex(each => each <= km);
  return wayIncludingTurnSeconds + tripSeconds - (times[left] ?? 0) - (km - (kms[left] ?? km)) / TRAIN_KM_PER_SECOND;
};

/**
 * A time as far into a repeating span.
 *
 * @param seconds - The time.
 * @param span - How long the span is.
 * @returns How far into it, from 0.
 */
const within = (seconds: number, span: number): number => ((seconds % span) + span) % span;

/**
 * When a route's trains take each place they can meet another's: entering each stretch of track, either
 * way, and reaching each end, where trains of routes ending there would stand together.
 *
 * @param timetable - The route's timetable.
 * @returns Each place, with how far into a train's round.
 */
const entriesOf = (timetable: RouteTimetable): Map<string, number> => {
  const { run, tripSeconds, wayIncludingTurnSeconds } = timetable;
  const entries = new Map<string, number>();
  for (const { segment, forward, startKm } of run.legs) {
    entries.set(`${segment.index}${forward ? '+' : '-'}`, passSeconds(timetable, startKm, 1));
    entries.set(`${segment.index}${forward ? '-' : '+'}`, passSeconds(timetable, startKm + segment.lengthKm, -1));
  }
  entries.set(`at ${run.ends[1]}`, tripSeconds);
  entries.set(`at ${run.ends[0]}`, wayIncludingTurnSeconds + tripSeconds);
  return entries;
};

/**
 * The start that keeps a route's trains furthest from those already placed, everywhere they can meet.
 * Trains at one pace keep the gap they enter a stretch with.
 *
 * @param offsets - How far each train already placed is from this route's where they can meet, seconds.
 * @param everySeconds - How long after one train the next comes.
 * @returns The phase, seconds.
 */
const clearestPhase = (offsets: number[], everySeconds: number): number => {
  let best = 0;
  let widest = -1;
  for (let phase = 0; phase < everySeconds; phase += TRAIN_PHASE_STEP_SECONDS) {
    let narrowest = Infinity;
    for (const offset of offsets) {
      const apart = within(offset - phase, everySeconds);
      narrowest = Math.min(narrowest, apart, everySeconds - apart);
    }
    if (narrowest <= widest) continue;

    widest = narrowest;
    best = phase;
  }
  return best;
};

/**
 * A line's routes, sharing its interval: each runs as often as its share of it, so a line that forks
 * into many keeps its shared track as calm as a line's alone, and each is placed clear of those before
 * it. A train comes no less often than its longest trip takes, or a short line would stand empty.
 *
 * @param runs - The line's routes.
 * @param intervalSeconds - The interval.
 * @returns Their timetables.
 */
const lineTimetablesOf = (runs: TrainRun[], intervalSeconds: number): RouteTimetable[] => {
  const longestTrip = Math.max(...runs.map(run => timetableOf(run, intervalSeconds).tripSeconds));
  const everySeconds = Math.min(intervalSeconds * runs.length, longestTrip);
  const placed = new Map<string, number[]>();
  return runs.map(run => {
    const timetable = timetableOf(run, everySeconds);
    const entries = entriesOf(timetable);
    const offsets = [...entries].flatMap(([where, seconds]) => (placed.get(where) ?? []).map(other => within(seconds - other, everySeconds)));
    const phaseSeconds = clearestPhase([...new Set(offsets.map(offset => Math.round(offset)))], everySeconds);
    for (const [where, seconds] of entries) pushTo(placed, where, within(seconds - phaseSeconds, everySeconds));
    return { ...timetable, phaseSeconds };
  });
};

/**
 * Every route's timetable, worked out from the routes alone, whatever the network.
 *
 * @param runs - Every line's routes.
 * @returns Their timetables.
 */
export const timetablesOf = (runs: TrainRun[]): RouteTimetable[] => {
  const lines = new Map<LineId, TrainRun[]>();
  for (const run of runs) pushTo(lines, run.line, run);
  const intervalSeconds = intervalOf([...lines.values()]);
  return [...lines.values()].flatMap(line => lineTimetablesOf(line, intervalSeconds));
};

/**
 * How far along a route a train is, a time into a trip.
 *
 * @param timetable - The route's timetable.
 * @param seconds - The time, within the trip.
 * @returns How far along it, km.
 */
const kmAt = ({ times, kms }: RouteTimetable, seconds: number): number => {
  const after = times.findIndex(time => time > seconds);
  if (after <= 0) return kms.at(-1) ?? 0;
  // Within bounds: `after` is a place in `times`, past its first, and `kms` is as long.
  const [fromTime, toTime, fromKm, toKm] = [times[after - 1]!, times[after]!, kms[after - 1]!, kms[after]!];
  return fromKm + ((toKm - fromKm) * (seconds - fromTime)) / (toTime - fromTime);
};

/**
 * Where a train is, a time into its round: out along the route, then back the same way. Between trips
 * it is turning at an end, and out of sight: left standing there, the next would run into it.
 *
 * @param timetable - The route's timetable.
 * @param into - How long into its round.
 * @returns Its place, or `null` while it is out of sight.
 */
const placeAt = (timetable: RouteTimetable, into: number): TrainPlace | null => {
  const { run, tripSeconds, wayIncludingTurnSeconds } = timetable;
  if (into < tripSeconds) return { run, km: kmAt(timetable, into), heading: 1 };
  const back = into - wayIncludingTurnSeconds;
  if (back < 0 || back >= tripSeconds) return null;
  return { run, km: kmAt(timetable, tripSeconds - back), heading: -1 };
};

/**
 * Where each train on a route is at a moment, each worked out from the clock alone, so it can be read
 * at any moment.
 *
 * @param timetable - The route's timetable.
 * @param seconds - The clock, seconds.
 * @returns Each train in sight.
 */
export const placesOf = (timetable: RouteTimetable, seconds: number): TrainPlace[] => {
  const { everySeconds, roundSeconds, phaseSeconds } = timetable;
  const places: TrainPlace[] = [];
  for (let train = 0; train * everySeconds < roundSeconds; train++) {
    const place = placeAt(timetable, within(seconds + phaseSeconds + train * everySeconds, roundSeconds));
    if (place) places.push(place);
  }
  return places;
};
