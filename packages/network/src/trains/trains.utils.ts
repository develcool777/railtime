import { pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId } from '@railtime/schema/network.types';
import { rideKmAt, rideSeconds, rideSecondsTo } from './motion.utils.ts';
import { CYCLE_SECONDS, TRACK_USE, TRAIN_PROFILES } from './trains.constants.ts';
import type { Conflict, Heading, Layover, Meeting, Ride, RouteSchedule, TrackRoom, TrainEnd, TrainPlace, TrainRun } from './trains.types';
import type { TrackSegment } from '../engine/engine.types';

/**
 * Whether a route closes on itself: a loop has no terminus, so its trains never turn.
 *
 * @param run - The route.
 * @returns Whether its ends are one station.
 */
export const isLoop = ({ ends }: TrainRun): boolean => ends[0] === ends[1];

/**
 * A time as far into the timetable's cycle.
 *
 * @param seconds - The time.
 * @returns How far into the cycle, from 0.
 */
export const withinCycle = (seconds: number): number => {
  const into = seconds % CYCLE_SECONDS;
  return into < 0 ? into + CYCLE_SECONDS : into;
};

/**
 * How a route's trains ride it one way: from stop to stop, pulling away and braking, standing at each.
 * The network keeps no timetable: this is an illustration, the same for every line of a kind.
 *
 * @param run - The route.
 * @returns Its ride.
 */
export const rideOf = (run: TrainRun): Ride => {
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
  return { run, times, kms, seconds: time };
};

/**
 * How long after setting out a train is ready to set off again from the end it comes to: its turn, but
 * for the standing at both ends its ride has in it. A loop's trains go on round, with no turn.
 *
 * @param run - The route.
 * @returns How long after coming in, seconds.
 */
export const turnSecondsOf = (run: TrainRun): number => {
  if (isLoop(run)) return 0;
  const { turnSeconds, standSeconds } = TRAIN_PROFILES[run.mode];
  return Math.max(0, turnSeconds - 2 * standSeconds);
};

/**
 * When a train going out first reaches a point on its route, or last stands there.
 *
 * @param ride - The route's ride.
 * @param km - How far along it the point is.
 * @param last - Whether to say when it leaves the point, not when it comes to it.
 * @returns How long after setting out, seconds.
 */
const outSeconds = ({ run, times, kms }: Ride, km: number, last: boolean): number => {
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
 * When a train heading one way reaches a point on its route.
 *
 * @param ride - The route's ride.
 * @param km - How far along it the point is.
 * @param heading - Which way the train is heading.
 * @returns How long after setting out that way, seconds.
 */
export const passSeconds = (ride: Ride, km: number, heading: Heading): number =>
  heading === 1 ? outSeconds(ride, km, false) : ride.seconds - outSeconds(ride, km, true);

/**
 * How far along a route a train going out is, a time after setting out.
 *
 * @param ride - The route's ride.
 * @param seconds - The time, within the ride.
 * @returns How far along it, km.
 */
const outKmAt = ({ run, times, kms }: Ride, seconds: number): number => {
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
 * How far along a route a train heading one way is, a time after setting out that way.
 *
 * @param ride - The route's ride.
 * @param seconds - The time, within the ride.
 * @param heading - Which way.
 * @returns How far along it, km, from its first end.
 */
export const kmAt = (ride: Ride, seconds: number, heading: Heading): number => outKmAt(ride, heading === 1 ? seconds : ride.seconds - seconds);

/**
 * Which of a segment's tracks a line runs on: the one its lines share, where it says nothing of its
 * tracks; else the one naming the line, or one of the line's own, where none does (a plan's line on it).
 *
 * @param segment - The segment.
 * @param line - The line.
 * @returns The track, as a place names it.
 */
const trackOf = ({ tracks }: TrackSegment, line: LineId): string => {
  if (tracks.length === 0) return 'shared';
  const named = tracks.findIndex(track => track.includes(line));
  return named === -1 ? `of ${line}` : String(named);
};

/**
 * Every place a route's trains meet others, one way: each stretch of track they enter, any line's on
 * it, and, but on a loop, which has none, their line's platforms at the end they head for (another line
 * ending at the same station has its own). Each with how long after setting out they come to it, and
 * how far behind another train their kind's signals let them.
 *
 * @param ride - The route's ride.
 * @param heading - Which way.
 * @returns The places.
 */
export const meetingsOf = (ride: Ride, heading: Heading): Meeting[] => {
  const { run } = ride;
  const separation = TRAIN_PROFILES[run.mode].closestSeconds;
  const meetings = run.legs.map(({ segment, forward, startKm }) => {
    const along = heading === 1 ? forward : !forward;
    const seconds = heading === 1 ? passSeconds(ride, startKm, 1) : passSeconds(ride, startKm + segment.lengthKm, -1);
    return { place: `track ${segment.index} ${trackOf(segment, run.line)} ${along ? '+' : '-'}`, seconds, separation };
  });
  if (isLoop(run)) return meetings;
  return [...meetings, { place: `platforms ${run.line} ${run.ends[heading === 1 ? 1 : 0]}`, seconds: ride.seconds, separation }];
};

/**
 * How far apart two times within the cycle are round it, either way.
 *
 * @param first - A time, within the cycle.
 * @param second - Another.
 * @returns How far, seconds.
 */
const apart = (first: number, second: number): number => {
  const gap = Math.abs(first - second);
  return gap > CYCLE_SECONDS / 2 ? CYCLE_SECONDS - gap : gap;
};

/**
 * How clear of every conflict a train setting out at a time is.
 *
 * @param departure - When it sets out, within the cycle.
 * @param conflicts - The conflicts.
 * @returns How much further from the nearest than it need be, seconds: below 0 too close; `Infinity` with none.
 */
export const clearanceAt = (departure: number, conflicts: readonly Conflict[]): number => {
  let clearest = Infinity;
  for (const { center, reach } of conflicts) clearest = Math.min(clearest, apart(departure, center) - reach);
  return clearest;
};

/**
 * The spells of the cycle a train may set out in, clear of every conflict.
 *
 * @param conflicts - The conflicts.
 * @returns Each spell's start and end, within the cycle.
 */
const clearSpellsOf = (conflicts: readonly Conflict[]): [number, number][] => {
  const blocked = conflicts
    .map(({ center, reach }): [number, number] => {
      const start = withinCycle(center - reach);
      return [start, start + 2 * reach];
    })
    .toSorted(([first], [second]) => first - second);
  // What runs past the cycle's end blocks its start.
  let covered = 0;
  for (const [, end] of blocked) covered = Math.max(covered, end - CYCLE_SECONDS);
  const spells: [number, number][] = [];
  for (const [start, end] of blocked) {
    if (start > covered) spells.push([covered, start]);
    covered = Math.max(covered, end);
  }
  if (covered < CYCLE_SECONDS) spells.push([covered, CYCLE_SECONDS]);
  return spells;
};

/**
 * Where a train comes least close to others, where none is clear of them all: midway between two of
 * them, as far as it can be from the nearest.
 *
 * @param conflicts - The conflicts.
 * @returns When it sets out.
 */
const leastCloseOf = (conflicts: readonly Conflict[]): number => {
  const centers = [...new Set(conflicts.map(({ center }) => center))].toSorted((first, second) => first - second);
  let best = 0;
  let clearest = -Infinity;
  for (const [place, center] of centers.entries()) {
    const midway = withinCycle((center + (centers[place + 1] ?? (centers[0] ?? 0) + CYCLE_SECONDS)) / 2);
    const clearance = clearanceAt(midway, conflicts);
    if (clearance <= clearest) continue;

    best = midway;
    clearest = clearance;
  }
  return best;
};

/**
 * The time nearest one wanted that a train may set out at, clear of every conflict; where none is, the
 * one it comes least close to others at, as a timetable on a track too full for every train's path
 * squeezes them closer.
 *
 * @param wanted - When it would set out.
 * @param conflicts - The conflicts.
 * @returns When it sets out, within the cycle.
 */
export const nearestClearTo = (wanted: number, conflicts: readonly Conflict[]): number => {
  const spells = clearSpellsOf(conflicts);
  if (spells.length === 0) return leastCloseOf(conflicts);
  const moment = withinCycle(wanted);
  let best = moment;
  let nearest = Infinity;
  for (const [start, end] of spells) {
    if (start <= moment && moment <= end) return moment;
    for (const edge of [start, end]) {
      if (apart(edge, moment) >= nearest) continue;

      nearest = apart(edge, moment);
      best = withinCycle(edge);
    }
  }
  return best;
};

/**
 * Each place's room, and the routes on it: as many trains a cycle as come no closer than the most
 * cautious of its trains' signals allow, but for a margin (`TRACK_USE`).
 *
 * @param meetings - Where each route's trains meet others, both ways.
 * @returns Each place's room.
 */
export const roomsOf = (meetings: readonly (readonly Meeting[])[]): Map<string, TrackRoom> => {
  const routes = new Map<string, number[]>();
  const separations = new Map<string, number>();
  for (const [route, ofRoute] of meetings.entries())
    for (const { place, separation } of ofRoute) {
      if (!routes.get(place)?.includes(route)) pushTo(routes, place, route);
      separations.set(place, Math.max(separations.get(place) ?? 0, separation));
    }
  return new Map([...routes].map(([place, onIt]) => [place, { room: (TRACK_USE * CYCLE_SECONDS) / (separations.get(place) ?? CYCLE_SECONDS), routes: onIt }]));
};

/**
 * How the trains coming in to an end of a line set out again: each takes the next train setting out
 * once it is ready, whichever of the line's routes it sets out on, in the order they come in, first in
 * first out, as an operator works a terminus. Of the ways to pair them so, the one the trains wait least
 * in, so the line needs no more trains than it must. Each stands at its platform until it sets out,
 * never out of sight.
 *
 * @param end - The trains coming in and setting out, and how long after coming in one is ready.
 * @returns Each train's stand there, on the route it came in on.
 */
export const layoversAt = ({ arrivals, departures, readySeconds }: TrainEnd): { route: number; layover: Layover }[] => {
  const coming = arrivals.map(arrival => ({ ...arrival, seconds: withinCycle(arrival.seconds) })).toSorted((first, second) => first.seconds - second.seconds);
  const leaving = departures.map(withinCycle).toSorted((first, second) => first - second);
  const waitFor = (arrival: number, place: number, shift: number) =>
    readySeconds + withinCycle(required(leaving[(place + shift) % leaving.length], 'as many leave as come') - arrival - readySeconds);
  let best = 0;
  let least = Infinity;
  for (const shift of leaving.keys()) {
    let waiting = 0;
    for (const [place, { seconds }] of coming.entries()) waiting += waitFor(seconds, place, shift);
    if (waiting >= least) continue;

    best = shift;
    least = waiting;
  }
  return coming.map(({ seconds, route, km, heading }, place) => ({
    route,
    layover: { fromSeconds: seconds, seconds: waitFor(seconds, place, best), km, heading },
  }));
};

/**
 * How long ago something going on now began, by the cycle's clock: once, or more for something longer
 * than a cycle.
 *
 * @param now - The time, within the cycle.
 * @param from - When it begins, within the cycle.
 * @param seconds - How long it goes on.
 * @returns How long ago each began.
 */
export const goingOn = (now: number, from: number, seconds: number): number[] => {
  const elapsed: number[] = [];
  for (let since = withinCycle(now - from); since < seconds; since += CYCLE_SECONDS) elapsed.push(since);
  return elapsed;
};

/**
 * Where each of a route's trains is at a moment: every trip under way, out or back, and every train
 * standing at an end it came in to on it.
 *
 * @param route - The route's schedule.
 * @param now - The moment, within the cycle.
 * @returns Each train.
 */
export const placesOf = ({ run, ride, departures, layovers }: RouteSchedule, now: number): TrainPlace[] => [
  ...departures.out.flatMap(departure => goingOn(now, departure, ride.seconds).map(since => ({ run, km: kmAt(ride, since, 1), heading: 1 as const }))),
  ...departures.back.flatMap(departure => goingOn(now, departure, ride.seconds).map(since => ({ run, km: kmAt(ride, since, -1), heading: -1 as const }))),
  ...layovers.flatMap(({ fromSeconds, seconds, km, heading }) => goingOn(now, fromSeconds, seconds).map(() => ({ run, km, heading }))),
];
