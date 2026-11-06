import { pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId } from '@railtime/schema/network.types';
import { rideKmAt, rideSeconds, rideSecondsTo } from './motion.utils.ts';
import { TRAIN_PROFILES } from './trains.constants.ts';
import type { Heading, RouteTimetable, TrainPlace, TrainRun } from './trains.types';

/**
 * A time as far into a repeating span.
 *
 * @param seconds - The time.
 * @param span - How long the span is.
 * @returns How far into it, from 0.
 */
const within = (seconds: number, span: number): number => ((seconds % span) + span) % span;

/**
 * Whether a route closes on itself: a loop has no terminus, so its trains never turn.
 *
 * @param run - The route.
 * @returns Whether its ends are one station.
 */
const isLoop = ({ ends }: TrainRun): boolean => ends[0] === ends[1];

/**
 * A route's timetable with its trains' turns laid in, as a timetable's are: a train leaves each end on
 * the beat that end keeps, the turn at least as long as it takes and the wait for that beat on top of it.
 * So how many trains a route needs comes out of it, its round over `everySeconds`, and with both ends on
 * one beat a train leaves each end at the same moment. A loop has no ends: its trains go on round, each
 * way its own, held at where it closes only for the lap to come to a whole number of trains.
 *
 * @param timetable - The timetable.
 * @param outPhase - The beat its first end keeps, seconds.
 * @param backPhase - The beat its far end keeps, seconds.
 * @returns The timetable, turned.
 */
const turnedAt = (timetable: RouteTimetable, outPhase: number, backPhase: number): RouteTimetable => {
  const { run, tripSeconds, everySeconds } = timetable;
  if (isLoop(run)) return { ...timetable, backAfterSeconds: 0, roundSeconds: Math.ceil(tripSeconds / everySeconds) * everySeconds, phaseSeconds: outPhase };
  const { turnSeconds, standSeconds } = TRAIN_PROFILES[run.mode];
  // A trip stands at both its ends, and that standing is part of the turn.
  const ready = tripSeconds + Math.max(0, turnSeconds - 2 * standSeconds);
  const backAfterSeconds = ready + within(outPhase - backPhase - ready, everySeconds);
  return { ...timetable, backAfterSeconds, roundSeconds: Math.ceil((backAfterSeconds + ready) / everySeconds) * everySeconds, phaseSeconds: outPhase };
};

/**
 * How trains run along a route: from stop to stop, pulling away and braking, standing at each, and
 * back the same way. The network keeps no timetable: this is an illustration, the same for every line
 * of a kind.
 *
 * @param run - The route.
 * @param everySeconds - How long after one train the next comes along it.
 * @returns Its timetable, on its own clock.
 */
export const timetableOf = (run: TrainRun, everySeconds: number): RouteTimetable => {
  const profile = TRAIN_PROFILES[run.mode];
  const times = [0];
  const kms = [0];
  let time = 0;
  let km = 0;
  const rideTo = (next: number) => {
    if (next === km) return;
    time += rideSeconds(profile, next - km);
    km = next;
    times.push(time);
    kms.push(km);
  };
  // A loop's last stop is its first, and a lap stands there once.
  for (const stop of isLoop(run) ? run.stopsKm.filter(each => each < run.lengthKm) : run.stopsKm) {
    rideTo(stop);
    time += profile.standSeconds;
    times.push(time);
    kms.push(km);
  }
  rideTo(run.lengthKm);
  return turnedAt({ run, times, kms, tripSeconds: time, everySeconds, backAfterSeconds: 0, roundSeconds: 0, phaseSeconds: 0 }, 0, 0);
};

/**
 * When a train going out first reaches a point on its route, or last stands there.
 *
 * @param timetable - The route's timetable.
 * @param km - How far along it the point is.
 * @param last - Whether to say when it leaves the point, not when it comes to it.
 * @returns How long into the trip, seconds.
 */
const outSeconds = ({ run, times, kms }: RouteTimetable, km: number, last: boolean): number => {
  const place = last ? kms.findLastIndex(each => each <= km) : kms.findIndex(each => each >= km);
  // `km` is on the route, and `kms` runs from its start to its end.
  if (kms[place] === km) return required(times[place], 'a time at a stop');
  const from = last ? place : place - 1;
  const fromKm = required(kms[from], 'a stop along the route');
  return (
    required(times[from], 'a time at a stop') +
    rideSecondsTo(TRAIN_PROFILES[run.mode], required(kms[from + 1], 'the next stop along the route') - fromKm, km - fromKm)
  );
};

/**
 * When a train on a route reaches a point on it, on the route's clock.
 *
 * @param timetable - The route's timetable.
 * @param km - How far along it the point is.
 * @param heading - Which way the train is heading.
 * @returns How long into its round, seconds.
 */
export const passSeconds = (timetable: RouteTimetable, km: number, heading: Heading): number => {
  if (heading === 1) return outSeconds(timetable, km, false);
  return timetable.backAfterSeconds + timetable.tripSeconds - outSeconds(timetable, km, true);
};

/**
 * When a route's trains going one way take each place they can meet another's: entering each stretch of
 * track, and reaching the end they head for.
 *
 * @param timetable - The route's timetable.
 * @param heading - Which way.
 * @returns Each place, with how long after they set out.
 */
const entriesOf = (timetable: RouteTimetable, heading: Heading): Map<string, number> => {
  const { run, tripSeconds, backAfterSeconds } = timetable;
  const entries = new Map<string, number>();
  for (const { segment, forward, startKm } of run.legs) {
    if (heading === 1) entries.set(`${segment.index}${forward ? '+' : '-'}`, passSeconds(timetable, startKm, 1));
    else entries.set(`${segment.index}${forward ? '-' : '+'}`, passSeconds(timetable, startKm + segment.lengthKm, -1) - backAfterSeconds);
  }
  entries.set(`at ${run.ends[heading === 1 ? 1 : 0]}`, tripSeconds);
  return entries;
};

/**
 * The beat that keeps a route's trains furthest from those already placed, everywhere they can meet:
 * a whole number of slots on from a train, so a line's routes come in turn along the track they share,
 * as branches do. Trains of a line keep the gap they enter a stretch with.
 *
 * @param offsets - How far each train already placed is from this route's where they can meet, seconds.
 * @param slotSeconds - How long after one train the next comes along the track they share.
 * @param everySeconds - How long after one of the route's trains the next comes.
 * @returns The beat, seconds.
 */
const clearestPhase = (offsets: number[], slotSeconds: number, everySeconds: number): number => {
  let best = 0;
  let widest = -1;
  for (const offset of offsets) {
    for (let slot = slotSeconds; slot < everySeconds; slot += slotSeconds) {
      const phase = within(offset + slot, everySeconds);
      let narrowest = Infinity;
      for (const other of offsets) {
        const apart = within(other - phase, everySeconds);
        narrowest = Math.min(narrowest, apart, everySeconds - apart);
      }
      if (narrowest <= widest) continue;

      widest = narrowest;
      best = phase;
    }
  }
  return best;
};

/**
 * How long after one train the next comes along each of the routes of a service. A route keeps its
 * kind's headway, and those sharing track add up along it, as a line's branches do, until they would
 * come closer than its trains may: past that, each runs less often.
 *
 * @param runs - The routes.
 * @returns How long, seconds.
 */
const everySecondsOf = (runs: TrainRun[]): number => {
  const { headwaySeconds, closestSeconds } = TRAIN_PROFILES[required(runs[0], 'a service is never empty').mode];
  return Math.max(headwaySeconds, closestSeconds * runs.length);
};

/**
 * A line's routes that share track, timed as one: their trains come in turn along it, evenly. Each way
 * is placed on its own: the turn at an end takes up what is between them.
 *
 * @param runs - The routes.
 * @returns Their timetables.
 */
const serviceTimetablesOf = (runs: TrainRun[]): RouteTimetable[] => {
  const everySeconds = everySecondsOf(runs);
  const placed = new Map<string, number[]>();
  const place = (timetable: RouteTimetable, heading: Heading): number => {
    const entries = entriesOf(timetable, heading);
    const offsets = [...entries].flatMap(([where, seconds]) => (placed.get(where) ?? []).map(other => within(seconds - other, everySeconds)));
    const phase = clearestPhase([...new Set(offsets.map(offset => Math.round(offset)))], everySeconds / runs.length, everySeconds);
    for (const [where, seconds] of entries) pushTo(placed, where, within(seconds - phase, everySeconds));
    return phase;
  };
  return runs.map(run => {
    const timetable = timetableOf(run, everySeconds);
    return turnedAt(timetable, place(timetable, 1), place(timetable, -1));
  });
};

/**
 * A line's routes as the services they make: routes sharing track or an end are one, a line in two
 * pieces two.
 *
 * @param runs - The line's routes, each after one it joins.
 * @returns Each service's routes.
 */
const servicesOf = (runs: TrainRun[]): TrainRun[][] => {
  const services: { routes: TrainRun[]; places: Set<number | string> }[] = [];
  for (const run of runs) {
    const places = new Set<number | string>([...run.ends, ...run.legs.map(({ segment }) => segment.index)]);
    const joined = services.find(service => !service.places.isDisjointFrom(places));
    if (!joined) {
      services.push({ routes: [run], places });
      continue;
    }
    joined.routes.push(run);
    for (const place of places) joined.places.add(place);
  }
  return services.map(({ routes }) => routes);
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
  return [...lines.values()].flatMap(line => servicesOf(line).flatMap(serviceTimetablesOf));
};

/**
 * How many trains a route takes: its round over how often they come, as an operator works it out; each
 * way its own on a loop run both ways.
 *
 * @param timetable - The route's timetable.
 * @returns How many.
 */
export const trainsOn = ({ run, roundSeconds, everySeconds }: RouteTimetable): number => (roundSeconds / everySeconds) * (isLoop(run) && !run.oneWay ? 2 : 1);

/**
 * How far along a route a train is, a time into a trip.
 *
 * @param timetable - The route's timetable.
 * @param seconds - The time, within the trip.
 * @returns How far along it, km.
 */
const kmAt = ({ run, times, kms }: RouteTimetable, seconds: number): number => {
  const after = times.findIndex(time => time > seconds);
  if (after <= 0) return kms.at(-1) ?? 0;
  // `after` is a place in `times`, past its first, and `kms` is as long.
  const [fromTime, fromKm, toKm] = [
    required(times[after - 1], 'a time at a stop'),
    required(kms[after - 1], 'a stop along the route'),
    required(kms[after], 'the next stop'),
  ];
  if (fromKm === toKm) return fromKm;
  return fromKm + rideKmAt(TRAIN_PROFILES[run.mode], toKm - fromKm, seconds - fromTime);
};

/**
 * Where a train is, a time into its round: out along the route, then back the same way. Between trips
 * it is turning at an end, and out of sight: past the platform, in a siding or at the other platform.
 *
 * @param timetable - The route's timetable.
 * @param into - How long into its round.
 * @returns Its place, or `null` while it is out of sight.
 */
const placeAt = (timetable: RouteTimetable, into: number): TrainPlace | null => {
  const { run, tripSeconds, backAfterSeconds } = timetable;
  if (into < tripSeconds) return { run, km: kmAt(timetable, into), heading: 1 };
  const back = into - backAfterSeconds;
  if (back < 0 || back >= tripSeconds) return null;
  return { run, km: kmAt(timetable, tripSeconds - back), heading: -1 };
};

/**
 * Where a loop's trains are, a time into a lap: one each way round, or the one way its line goes,
 * always in sight, a loop having nowhere to turn. Past a lap's time each is held at where it closes.
 *
 * @param timetable - The route's timetable.
 * @param into - How long into the lap.
 * @returns Their places.
 */
const lapPlacesAt = (timetable: RouteTimetable, into: number): TrainPlace[] => {
  const { run, tripSeconds } = timetable;
  const ridden = Math.min(into, tripSeconds);
  const places: TrainPlace[] = [
    { run, km: kmAt(timetable, ridden), heading: 1 },
    { run, km: kmAt(timetable, tripSeconds - ridden), heading: -1 },
  ];
  return places.filter(({ heading }) => heading === 1 || !run.oneWay);
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
  const { run, everySeconds, roundSeconds, phaseSeconds } = timetable;
  const places: TrainPlace[] = [];
  for (let train = 0; train * everySeconds < roundSeconds; train++) {
    const into = within(seconds + phaseSeconds + train * everySeconds, roundSeconds);
    if (isLoop(run)) {
      places.push(...lapPlacesAt(timetable, into));
      continue;
    }
    const place = placeAt(timetable, into);
    if (place) places.push(place);
  }
  return places;
};
