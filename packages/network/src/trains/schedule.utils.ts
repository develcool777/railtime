import { firstDifference, pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import { rideKmAt, rideSeconds, rideSecondsTo } from './motion.utils.ts';
import { TRAIN_PROFILES } from './trains.constants.ts';
import type { Heading, Passing, RouteTimetable, TakenBeats, TrainPlace, TrainRun } from './trains.types';
import type { TrackSegment } from '../engine/engine.types';

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
 * How long after a train sets out it could set off back: its trip, and its turn at the far end. A trip
 * stands at both its ends, and that standing is part of the turn.
 *
 * @param timetable - The route's timetable.
 * @returns How long, seconds.
 */
const readySeconds = ({ run, tripSeconds }: RouteTimetable): number => {
  const { turnSeconds, standSeconds } = TRAIN_PROFILES[run.mode];
  return tripSeconds + Math.max(0, turnSeconds - 2 * standSeconds);
};

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
  const ready = readySeconds(timetable);
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
 * Which of a segment's tracks a line runs on: the one naming it; where the segment names none, or not
 * this line, the one its lines share.
 *
 * @param segment - The segment.
 * @param line - The line.
 * @returns The track, by its place among the segment's; -1 for the one its lines share.
 */
const trackOf = ({ tracks }: TrackSegment, line: LineId): number => tracks.findIndex(track => track.includes(line));

/**
 * A way along a track, where the trains of every line on it meet.
 *
 * @param segment - The segment the track is on.
 * @param line - A line running on it.
 * @param forward - Whether the way is from the segment's station A to its station B.
 * @returns The place.
 */
const trackPlace = (segment: TrackSegment, line: LineId, forward: boolean): string => `track ${segment.index}.${trackOf(segment, line)} ${forward ? '+' : '-'}`;

/**
 * A line's platforms at a station it ends at, where its own trains meet: another line ending there has its own.
 *
 * @param line - The line.
 * @param station - The station.
 * @returns The place.
 */
const platformsPlace = (line: LineId, station: StationId): string => `platforms ${line} ${station}`;

/**
 * When a route's trains going one way take each place they can meet another's: entering each stretch of
 * track, and reaching its line's platforms at the end they head for.
 *
 * @param timetable - The route's timetable.
 * @param heading - Which way.
 * @returns Each place, with how long after they set out.
 */
const entriesOf = (timetable: RouteTimetable, heading: Heading): Map<string, number> => {
  const { run, tripSeconds, backAfterSeconds } = timetable;
  const entries = new Map<string, number>();
  for (const { segment, forward, startKm } of run.legs) {
    if (heading === 1) entries.set(trackPlace(segment, run.line, forward), passSeconds(timetable, startKm, 1));
    else entries.set(trackPlace(segment, run.line, !forward), passSeconds(timetable, startKm + segment.lengthKm, -1) - backAfterSeconds);
  }
  entries.set(platformsPlace(run.line, run.ends[heading === 1 ? 1 : 0]), tripSeconds);
  return entries;
};

/**
 * The greatest whole number of seconds two spans are each a whole number of: trains on one, every so
 * often, and on the other meet once in each such span, wherever their beats are.
 *
 * @param first - A span, whole seconds.
 * @param second - Another.
 * @returns Their greatest common divisor.
 */
const commonSpan = (first: number, second: number): number => (second === 0 ? first : commonSpan(second, first % second));

/**
 * How far a beat is from the nearest of others, round a route's span, to the second.
 *
 * @param phase - The beat.
 * @param taken - The others.
 * @param everySeconds - The span.
 * @returns How far, seconds; `Infinity` with none.
 */
const clearanceOf = (phase: number, taken: readonly number[], everySeconds: number): number => {
  let narrowest = Infinity;
  for (const other of taken) {
    const apart = within(other - phase, everySeconds);
    narrowest = Math.min(narrowest, apart, everySeconds - apart);
  }
  return Math.round(narrowest);
};

/**
 * The beats midway between others, round a route's span.
 *
 * @param taken - The others.
 * @param everySeconds - The span.
 * @returns A beat midway between each and the next.
 */
const midwaysOf = (taken: readonly number[], everySeconds: number): number[] => {
  const beats = [...new Set(taken)].toSorted((first, second) => first - second);
  return beats.map((beat, place) => within((beat + (beats[place + 1] ?? (beats[0] ?? 0) + everySeconds)) / 2, everySeconds));
};

/**
 * The beat for a route's trains, given those already placed where they can meet. Its own line's are
 * kept apart first, as signals keep them: a whole number of slots on from one of them, so a line's
 * routes come in turn along the track they share, as branches do, trains of a line keeping the gap
 * they enter a stretch with. Of the beats that keep them as far apart, the one furthest from other
 * lines'. With none of its own line's, midway between other lines', or the beat it keeps on its own
 * where that is as clear of them.
 *
 * @param taken - The beats that would bring it onto a train already placed.
 * @param slotSeconds - How long after one train the next comes along the track its line's routes share.
 * @param everySeconds - How long after one of the route's trains the next comes.
 * @param ownPhase - The beat it keeps on its own, seconds.
 * @returns The beat, seconds.
 */
const clearestPhase = ({ own, others }: TakenBeats, slotSeconds: number, everySeconds: number, ownPhase: number): number => {
  const candidates = own.length > 0 ? [] : [ownPhase, ...midwaysOf(others, everySeconds)];
  for (const offset of own) for (let slot = slotSeconds; slot < everySeconds; slot += slotSeconds) candidates.push(within(offset + slot, everySeconds));
  let best = ownPhase;
  let ownWidest = -1;
  let othersWidest = -1;
  for (const phase of candidates) {
    const ownClear = clearanceOf(phase, own, everySeconds);
    const othersClear = clearanceOf(phase, others, everySeconds);
    if (ownClear < ownWidest || (ownClear === ownWidest && othersClear <= othersWidest)) continue;

    best = phase;
    ownWidest = ownClear;
    othersWidest = othersClear;
  }
  return best;
};

/**
 * The beats that would bring a route's trains onto others already placed where they meet, its own
 * line's apart. Trains on two lines meet once in each span both their headways are a whole number of:
 * unless one is a whole number of the other, that is more often than either runs, and they pass through
 * each other whatever their beats, as lines on unrelated headways do, and keep clear of none.
 *
 * @param entries - Where the route's trains meet others, with how long after they set out.
 * @param placed - Where trains already placed pass.
 * @param service - The route's service.
 * @param everySeconds - How long after one of the route's trains the next comes.
 * @returns The beats.
 */
const takenBeatsOf = (entries: Map<string, number>, placed: Map<string, Passing[]>, service: number, everySeconds: number): TakenBeats => {
  const own: number[] = [];
  const others: number[] = [];
  for (const [where, seconds] of entries)
    for (const passing of placed.get(where) ?? []) {
      if (passing.service === service) {
        own.push(Math.round(within(seconds - passing.clockSeconds, everySeconds)));
        continue;
      }
      const span = commonSpan(everySeconds, passing.everySeconds);
      if (span < Math.min(everySeconds, passing.everySeconds)) continue;
      for (let beat = within(seconds - passing.clockSeconds, span); beat < everySeconds; beat += span) others.push(Math.round(beat));
    }
  return { own: [...new Set(own)], others: [...new Set(others)] };
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
 * A line's routes that share track, timed as one: their trains come in turn along it, evenly, and clear
 * of the trains of other lines already placed on the same track. Each way is placed on its own: the turn
 * at an end takes up what is between them.
 *
 * @param runs - The routes.
 * @param service - Which service they are, among every line's.
 * @param placed - Where trains already placed pass, every service's: added to.
 * @returns Their timetables.
 */
const serviceTimetablesOf = (runs: TrainRun[], service: number, placed: Map<string, Passing[]>): RouteTimetable[] => {
  const everySeconds = everySecondsOf(runs);
  const place = (timetable: RouteTimetable, heading: Heading, ownPhase: number): number => {
    const entries = entriesOf(timetable, heading);
    const phase = clearestPhase(takenBeatsOf(entries, placed, service, everySeconds), everySeconds / runs.length, everySeconds, ownPhase);
    for (const [where, seconds] of entries) pushTo(placed, where, { clockSeconds: within(seconds - phase, everySeconds), everySeconds, service });
    return phase;
  };
  return runs.map(run => {
    const timetable = timetableOf(run, everySeconds);
    const outPhase = place(timetable, 1, 0);
    // On its own, a train sets off back as soon as it has turned.
    return turnedAt(timetable, outPhase, place(timetable, -1, within(outPhase - readySeconds(timetable), everySeconds)));
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
 * Every route's timetable, worked out from the routes alone, whatever the network: each line's
 * services at its own headway, placed the most frequent first, as an operator gives way, each clear of
 * those before it on the track they share.
 *
 * @param runs - Every line's routes.
 * @returns Their timetables, each line's together, in the order given.
 */
export const timetablesOf = (runs: TrainRun[]): RouteTimetable[] => {
  const lines = new Map<LineId, TrainRun[]>();
  for (const run of runs) pushTo(lines, run.line, run);
  const services = [...lines.values()].flatMap(servicesOf);
  const busiestFirst = services
    .map((routes, service) => ({ routes, service, everySeconds: everySecondsOf(routes), line: required(routes[0], 'a service is never empty').line }))
    .toSorted((first, second) =>
      firstDifference(first.everySeconds - second.everySeconds, byCodeUnits(first.line, second.line), first.service - second.service),
    );
  const placed = new Map<string, Passing[]>();
  const timed = new Map<number, RouteTimetable[]>();
  for (const { routes, service } of busiestFirst) timed.set(service, serviceTimetablesOf(routes, service, placed));
  return services.flatMap((_routes, service) => timed.get(service) ?? []);
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
 * it is turning at an end, and stands at its platform there until it sets off back, so no train ever
 * goes out of sight: one that would wait in a siding stands in view, over the one that comes in after it.
 *
 * @param timetable - The route's timetable.
 * @param into - How long into its round.
 * @returns Its place.
 */
const placeAt = (timetable: RouteTimetable, into: number): TrainPlace => {
  const { run, tripSeconds, backAfterSeconds } = timetable;
  if (into < tripSeconds) return { run, km: kmAt(timetable, into), heading: 1 };
  const back = into - backAfterSeconds;
  if (back < 0) return { run, km: kmAt(timetable, tripSeconds), heading: -1 };
  if (back < tripSeconds) return { run, km: kmAt(timetable, tripSeconds - back), heading: -1 };
  return { run, km: kmAt(timetable, 0), heading: 1 };
};

/**
 * Where a loop's trains are, a time into a lap: one each way round, or the one way its line goes,
 * never turning, a loop having nowhere to. Past a lap's time each is held at where it closes.
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
 * @returns Each train.
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
    places.push(placeAt(timetable, into));
  }
  return places;
};
