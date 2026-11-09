import { pushTo } from '@railtime/core/collection.utils';
import { TrackTimetable } from './tracks.service.ts';
import { CYCLE_SECONDS } from './trains.constants.ts';
import type { Arrival, Departures, Heading, Layover, RouteSchedule, TrainEnd, TrainPlace, TrainRun } from './trains.types';
import { isLoop, layoversAt, placesOf, rideOf, turnSecondsOf, withinCycle } from './trains.utils.ts';

/**
 * The trains a network runs, worked out as an operator works out a timetable: when each route's trains
 * set out, clear of one another on every track (`TrackTimetable`), and how each turns at an end of its
 * line, taking the next train out there; so how many trains run comes out of the timetable, never aimed
 * at. The network keeps no timetable, so this is an illustration; it knows no map, and says only where
 * each train is, in real time: how fast to show it is the map's.
 */
export class TrainService {
  /** Each route's schedule. */
  public readonly routes: RouteSchedule[];

  /**
   * @param runs - Every way along each line from one end to another.
   */
  public constructor(runs: TrainRun[]) {
    const rides = runs.map(rideOf);
    const { departures } = new TrackTimetable(rides);
    const layovers = new Map<number, Layover[]>();
    for (const end of TrainService.endsOf(
      runs,
      departures,
      rides.map(({ seconds }) => seconds),
    ).values())
      for (const { route, layover } of layoversAt(end)) pushTo(layovers, route, layover);
    this.routes = rides.map((ride, route) => ({
      run: ride.run,
      ride,
      departures: departures[route] ?? { out: [], back: [] },
      layovers: layovers.get(route) ?? [],
    }));
  }

  /**
   * How many trains run: every one always on a trip or standing at an end, so what they all spend on each
   * over a cycle, a whole number of cycles.
   *
   * @returns The fleet.
   */
  public get fleet(): number {
    let busy = 0;
    for (const { ride, departures, layovers } of this.routes) {
      busy += (departures.out.length + departures.back.length) * ride.seconds;
      for (const { seconds } of layovers) busy += seconds;
    }
    return Math.round(busy / CYCLE_SECONDS);
  }

  /**
   * Where each train is at a moment, worked out from the clock alone, so it can be read at any moment:
   * every trip under way, out or back, and every train standing at an end between two.
   *
   * @param seconds - The clock, seconds.
   * @returns Their places.
   */
  public placesAt(seconds: number): TrainPlace[] {
    const now = withinCycle(seconds);
    return this.routes.flatMap(route => placesOf(route, now));
  }

  /**
   * Each end of a line where trains turn, with the trains coming in to it and setting out from it, of
   * every route of the line that ends there: they share its platforms, and any of them takes the next
   * train out. A loop's trains come round to where it closes and go on round, each way its own.
   *
   * @param runs - Every route.
   * @param departures - When each route's trains set out.
   * @param tripSeconds - How long each route's trip takes.
   * @returns Each end's trains.
   */
  private static endsOf(runs: readonly TrainRun[], departures: readonly Departures[], tripSeconds: readonly number[]): Map<string, TrainEnd> {
    const ends = new Map<string, TrainEnd>();
    const turn = (end: string, readySeconds: number, arrivals: Arrival[], leaving: number[]) => {
      const turning = ends.get(end) ?? { arrivals: [], departures: [], readySeconds };
      turning.arrivals.push(...arrivals);
      turning.departures.push(...leaving);
      ends.set(end, turning);
    };
    for (const [route, run] of runs.entries()) {
      const { out, back } = departures[route] ?? { out: [], back: [] };
      const ready = turnSecondsOf(run);
      const arriving = (leaving: number[], km: number, heading: Heading) =>
        leaving.map(departure => ({ seconds: departure + (tripSeconds[route] ?? 0), route, km, heading }));
      if (isLoop(run)) {
        turn(`${run.line} ${run.ends[0]} round +`, ready, arriving(out, run.lengthKm, 1), out);
        turn(`${run.line} ${run.ends[0]} round -`, ready, arriving(back, 0, -1), back);
        continue;
      }
      turn(`${run.line} ${run.ends[1]}`, ready, arriving(out, run.lengthKm, -1), back);
      turn(`${run.line} ${run.ends[0]}`, ready, arriving(back, 0, 1), out);
    }
    return ends;
  }
}
