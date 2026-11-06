import { firstDifference } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId, LoopWay, StationId } from '@railtime/schema/network.types';
import type { Heading, TrainLeg, TrainRun } from './trains.types';
import type { LineSegment } from '../engine/engine.types';
import type { NetworkIndex } from '../engine/index.service';
import { lineRuns } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';

/** A way along a line from one end to another: its stations, and the track between each and the next. */
type TrainRoute = { stations: StationId[]; track: LineSegment[] };

/**
 * How many of some stations another line meets: what a city's core is thick with.
 *
 * @param index - The network.
 * @param line - The line.
 * @param stations - The stations.
 * @returns How many.
 */
const interchangesOf = (index: NetworkIndex, line: LineId, stations: StationId[]): number =>
  stations.filter(station => index.transfersAt(station).length > 0 || index.lineSegmentsAt(station).some(each => each.line !== line)).length;

/**
 * Whether a branch from a station on a route goes on along the stations before it: never the side it
 * comes back to itself, as a line's second way through a city does, so no train doubles back; else
 * towards the core, the side more lines meet, or with none to tell, the side with more of the line.
 *
 * @param index - The network.
 * @param line - The line.
 * @param run - The branch.
 * @param route - The route.
 * @param place - Where on it the branch leaves.
 * @returns Whether its first side is the way on.
 */
const headsBefore = (index: NetworkIndex, line: LineId, run: TrainRoute, { stations }: TrainRoute, place: number): boolean => {
  const [before, after] = [stations.slice(0, place), stations.slice(place + 1)];
  const onward = (side: StationId[]) => (side.some(station => run.stations.includes(station)) ? 0 : 1);
  return (
    firstDifference(onward(before) - onward(after), interchangesOf(index, line, before) - interchangesOf(index, line, after), before.length - after.length) >= 0
  );
};

/**
 * A run of a line as a train runs it, end to end: a branch goes on past the fork it leaves towards the
 * core, along the way already laid out there, to the far end of it. Branches feed a city's core, so a
 * train from one never runs out along another. A run joined to none stands as it is.
 *
 * @param index - The network.
 * @param line - The line.
 * @param run - The run: a branch's first station is the one it leaves from.
 * @param routes - The routes of the line's runs before it.
 * @returns The route.
 */
const routeOf = (index: NetworkIndex, line: LineId, run: TrainRoute, routes: TrainRoute[]): TrainRoute => {
  const station = required(run.stations[0], 'a run is never empty');
  const trunk = routes.find(route => route.stations.includes(station));
  if (!trunk) return run;
  const place = trunk.stations.indexOf(station);
  if (headsBefore(index, line, run, trunk, place))
    return { stations: [...trunk.stations.slice(0, place), ...run.stations], track: [...trunk.track.slice(0, place), ...run.track] };
  return { stations: [...trunk.stations.slice(place + 1).toReversed(), ...run.stations], track: [...trunk.track.slice(place).toReversed(), ...run.track] };
};

/**
 * A line's routes: each of its runs of track, from end to end.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor: the track open then.
 * @returns Its routes, the longest first.
 */
const routesOf = (index: NetworkIndex, timeline: Timeline, line: LineId, cursor: number): TrainRoute[] => {
  const routes: TrainRoute[] = [];
  for (const run of lineRuns(index, timeline, line, cursor)) routes.push(routeOf(index, line, run, routes));
  return routes;
};

/**
 * Which way along a loop's route is the way its line goes, from how the route turns on the map: its
 * stations in order sweep an area, positive going anticlockwise.
 *
 * @param index - The network.
 * @param stations - The route's stations.
 * @param way - The way its line goes.
 * @returns The heading.
 */
const headingOf = (index: NetworkIndex, stations: StationId[], way: LoopWay): Heading => {
  let area = 0;
  for (const [place, station] of stations.entries()) {
    const [fromX, fromY] = index.coordOf(station);
    const [toX, toY] = index.coordOf(stations[place + 1] ?? station);
    area += fromX * toY - toX * fromY;
  }
  return area > 0 === (way === 'anticlockwise') ? 1 : -1;
};

/**
 * A route as a path to move along: where each stretch of track is, which way it is run, and the stops.
 * A station a line runs through without calling is no stop.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param route - The route.
 * @param cursor - The cursor.
 * @returns The run.
 */
const trainRunOf = (index: NetworkIndex, timeline: Timeline, line: LineId, { stations, track }: TrainRoute, cursor: number): TrainRun => {
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
  const { mode, way } = index.lineOf(line);
  return { line, mode, ends: [first, last], legs, lengthKm, stopsKm, ...(way && first === last && { oneWay: headingOf(index, stations, way) }) };
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
  index.lineIds.flatMap(line => routesOf(index, timeline, line, cursor).map(route => trainRunOf(index, timeline, line, route, cursor)));
