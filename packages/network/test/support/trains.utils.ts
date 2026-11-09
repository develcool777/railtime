import { pushTo } from '@railtime/core/collection.utils';
import { CYCLE_SECONDS } from '../../src/trains/trains.constants';
import type { TrainService } from '../../src/trains/trains.service';
import { passSeconds } from '../../src/trains/trains.utils';

/**
 * The shortest time between two trains entering the same track the same way, whichever lines': exact,
 * the timetable coming round each cycle, so it holds whenever the trains are watched.
 *
 * @param service - The trains.
 * @returns The shortest, seconds; `Infinity` where no two trains share a track.
 */
export const tightestHeadway = (service: TrainService): number => {
  const onTrack = new Map<string, number[]>();
  for (const { ride, departures } of service.routes)
    for (const { segment, forward, startKm } of ride.run.legs) {
      const track = `${segment.index} ${segment.tracks.findIndex(lines => lines.includes(ride.run.line))}`;
      const into = (departure: number, seconds: number) => (((departure + seconds) % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
      for (const departure of departures.out) pushTo(onTrack, `${track} ${forward}`, into(departure, passSeconds(ride, startKm, 1)));
      for (const departure of departures.back) pushTo(onTrack, `${track} ${!forward}`, into(departure, passSeconds(ride, startKm + segment.lengthKm, -1)));
    }
  let tightest = Infinity;
  for (const entries of onTrack.values()) {
    const sorted = entries.toSorted((first, second) => first - second);
    for (const [place, entry] of sorted.entries()) tightest = Math.min(tightest, (sorted[place + 1] ?? (sorted[0] ?? 0) + CYCLE_SECONDS) - entry);
  }
  return tightest;
};
