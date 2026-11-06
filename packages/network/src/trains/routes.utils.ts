import { required } from '@railtime/core/required.utils';
import type { LineId, StationId } from '@railtime/schema/network.types';
import type { TrainLeg, TrainRun } from './trains.types';
import type { LineSegment } from '../engine/engine.types';
import type { NetworkIndex } from '../engine/index.service';
import { lineRuns } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';

/** A way along a line from one end to another: its stations, and the track between each and the next. */
type TrainRoute = { stations: StationId[]; track: LineSegment[] };

/**
 * How long some track is.
 *
 * @param track - The track.
 * @returns Its length, km.
 */
const lengthOf = (track: LineSegment[]): number => {
  let km = 0;
  for (const { segment } of track) km += segment.lengthKm;
  return km;
};

/**
 * Whether more of a route lies before a station than after it: the side a branch from there goes on along.
 *
 * @param route - The route.
 * @param station - The station.
 * @returns Whether its first side is the longer.
 */
const longerBefore = ({ stations, track }: TrainRoute, station: StationId): boolean => {
  const place = stations.indexOf(station);
  return lengthOf(track.slice(0, place)) >= lengthOf(track.slice(place));
};

/**
 * A run of a line as a train runs it, end to end: a branch goes on past the fork it leaves, along the
 * way already laid out there, to the far end of it. A run joined to none stands as it is.
 *
 * @param run - The run: a branch's first station is the one it leaves from.
 * @param routes - The routes of the line's runs before it.
 * @returns The route.
 */
const routeOf = (run: TrainRoute, routes: TrainRoute[]): TrainRoute => {
  const station = required(run.stations[0], 'a run is never empty');
  const trunk = routes.find(route => route.stations.includes(station));
  if (!trunk) return run;
  const place = trunk.stations.indexOf(station);
  if (longerBefore(trunk, station))
    return { stations: [...trunk.stations.slice(0, place), ...run.stations], track: [...trunk.track.slice(0, place), ...run.track] };
  return { stations: [...trunk.stations.slice(place + 1).toReversed(), ...run.stations], track: [...trunk.track.slice(place).toReversed(), ...run.track] };
};

/**
 * A line's routes: each of its runs of track, from end to end. Its first route turns to start at the
 * end its first branch shares, so a train waiting at the far end of either waits off the shared track.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor: the track open then.
 * @returns Its routes, the longest first.
 */
const routesOf = (index: NetworkIndex, timeline: Timeline, line: LineId, cursor: number): TrainRoute[] => {
  const routes: TrainRoute[] = [];
  for (const run of lineRuns(index, timeline, line, cursor)) {
    const [first] = routes;
    const station = required(run.stations[0], 'a run is never empty');
    if (first && routes.length === 1 && first.stations.includes(station) && !longerBefore(first, station)) {
      routes[0] = { stations: first.stations.toReversed(), track: first.track.toReversed() };
    }
    routes.push(routeOf(run, routes));
  }
  return routes;
};

/**
 * A route as a path to move along: where each stretch of track is, which way it is run, and the stops.
 * A station a line runs through without calling is no stop.
 *
 * @param timeline - The network's timeline.
 * @param line - The line id.
 * @param route - The route.
 * @param cursor - The cursor.
 * @returns The run.
 */
const trainRunOf = (timeline: Timeline, line: LineId, { stations, track }: TrainRoute, cursor: number): TrainRun => {
  const legs: TrainLeg[] = [];
  const stopsKm: number[] = [];
  let lengthKm = 0;
  for (const [place, { segment }] of track.entries()) {
    const from = required(stations[place], `station ${place}`);
    if (timeline.servesStation(from, line, cursor)) stopsKm.push(lengthKm);
    legs.push({ segment, forward: segment.stationA === from, startKm: lengthKm });
    lengthKm += segment.lengthKm;
  }
  const first = required(stations[0], 'a run is never empty');
  const last = required(stations.at(-1), 'a run is never empty');
  if (timeline.servesStation(last, line, cursor)) stopsKm.push(lengthKm);
  return { line, ends: [first, last], legs, lengthKm, stopsKm };
};

/**
 * Where trains run at a moment: every way along each line from one end to another, so a line that
 * forks has a route to each of its ends, sharing the track before the fork. Which trains run, and
 * when, the network does not know: it keeps no timetable.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param cursor - The cursor: the track open then.
 * @returns A run for each route.
 */
export const trainRunsAt = (index: NetworkIndex, timeline: Timeline, cursor: number): TrainRun[] =>
  index.lineIds.flatMap(line => routesOf(index, timeline, line, cursor).map(route => trainRunOf(timeline, line, route, cursor)));
