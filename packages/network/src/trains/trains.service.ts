import { placesOf, timetablesOf, trainsOn } from './schedule.utils.ts';
import type { RouteTimetable, TrainPlace, TrainRun } from './trains.types';

/**
 * The trains a network runs at a moment, worked out as an operator works out a line's: how often its
 * kind of railway runs, how its routes share that, how long a round takes, and so how many trains it
 * needs. The network keeps no timetable, so this is an illustration; it knows no map, and says only
 * where each train is, in real time: how fast to show it is the map's.
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
   * How many trains run: those turning at an end too.
   *
   * @returns The fleet.
   */
  public get fleet(): number {
    let trains = 0;
    for (const timetable of this.timetables) trains += trainsOn(timetable);
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
