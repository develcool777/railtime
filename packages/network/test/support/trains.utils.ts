import { pushTo } from '@railtime/core/collection.utils';
import { passSeconds } from '../../src/trains/schedule.utils';
import type { TrainService } from '../../src/trains/trains.service';
import type { RouteTimetable } from '../../src/trains/trains.types';

/**
 * When a route's trains enter each stretch of track, each way, as far into their share of the interval.
 *
 * @param timetable - The route's timetable.
 * @returns Each stretch, by its line, segment and way, with when.
 */
const entriesOf = (timetable: RouteTimetable): [string, number][] => {
  const { run, everySeconds, phaseSeconds } = timetable;
  const within = (seconds: number) => (((seconds - phaseSeconds) % everySeconds) + everySeconds) % everySeconds;
  return run.legs.flatMap(({ segment, forward, startKm }): [string, number][] => [
    [`${run.line} ${segment.index} ${forward}`, within(passSeconds(timetable, startKm, 1))],
    [`${run.line} ${segment.index} ${!forward}`, within(passSeconds(timetable, startKm + segment.lengthKm, -1))],
  ]);
};

/**
 * The shortest time between two of a line's trains on any stretch of track, going the same way: exact,
 * every route of a line coming round on the same beat, so it holds whenever the trains are watched.
 *
 * @param service - The trains.
 * @returns The shortest headway, seconds; `Infinity` where no routes share track.
 */
export const tightestHeadway = (service: TrainService): number => {
  const onTrack = new Map<string, { seconds: number; every: number }[]>();
  for (const timetable of service.timetables) {
    for (const [stretch, seconds] of entriesOf(timetable)) pushTo(onTrack, stretch, { seconds, every: timetable.everySeconds });
  }
  let tightest = Infinity;
  for (const trains of onTrack.values()) {
    for (const [place, { seconds, every }] of trains.entries()) {
      for (const other of trains.slice(place + 1)) {
        const apart = Math.abs(seconds - other.seconds);
        tightest = Math.min(tightest, apart, every - apart);
      }
    }
  }
  return tightest;
};
