import { placesOf, timetablesOf } from './schedule.utils.ts';
import type { RouteTimetable, TrainPlace, TrainRun } from './trains.types';

/**
 * The trains a network runs at a moment, worked out from it alone, whatever its size: how often a line's
 * trains come, how its routes share that, and when each starts, so trains on shared track keep apart.
 * The network keeps no timetable, so this is an illustration; it knows no map, and says only where
 * each train is.
 */
export class TrainService {
  /** Each route's timetable. */
  public readonly timetables: RouteTimetable[];

  /**
   * @param runs - Every way along each line from one end to another.
   */
  public constructor(runs: TrainRun[]) {
    this.timetables = timetablesOf(runs);
  }

  /**
   * How many trains run: those turning at a far end too.
   *
   * @returns The fleet.
   */
  public get fleet(): number {
    let trains = 0;
    for (const { roundSeconds, everySeconds } of this.timetables) trains += roundSeconds / everySeconds;
    return trains;
  }

  /**
   * Where each train in sight is at a moment.
   *
   * @param seconds - The clock, seconds.
   * @returns Their places.
   */
  public placesAt(seconds: number): TrainPlace[] {
    return this.timetables.flatMap(timetable => placesOf(timetable, seconds));
  }
}
