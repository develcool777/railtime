import { pushTo } from '@railtime/core/collection.utils';
import { required } from '@railtime/core/required.utils';
import type { LineId, LoopWay, StationId } from '@railtime/schema/network.types';
import type { LineSegment, Step } from './engine.types';
import type { NetworkIndex } from './index.service';
import type { LineHop, LineRun } from './lineDetails.types';
import type { Timeline } from './timeline.service';
import type { LineDirection, Stop, StopToward } from '../facts/facts.types';

/** A line's track at a cursor, as a graph: each station's neighbours on it, with the km between. */
type LineGraph = Map<StationId, { to: StationId; km: number; edge: number }[]>;

/**
 * The track of some lines open at a cursor, each segment once, as a graph of stations: one line, or
 * those the map draws as one (`Timeline.linesDrawnAs`), which share track.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param lines - The line ids.
 * @param cursor - The cursor.
 * @returns The graph, either way along every segment, and the line segments in it.
 */
const lineGraph = (index: NetworkIndex, timeline: Timeline, lines: readonly LineId[], cursor: number): { graph: LineGraph; open: LineSegment[] } => {
  const openHere = lines.flatMap(line => index.lineSegmentsOf(line)).filter(lineSegment => timeline.isOpen(lineSegment, cursor));
  const open = [...new Map(openHere.map(lineSegment => [lineSegment.segment.index, lineSegment])).values()];
  const graph: LineGraph = new Map();
  for (const [edge, { segment }] of open.entries()) {
    const link = (from: StationId, to: StationId) => pushTo(graph, from, { to, km: segment.lengthKm, edge });
    link(segment.stationA, segment.stationB);
    link(segment.stationB, segment.stationA);
  }
  return { graph, open };
};

/**
 * Whether some lines call at a station at a cursor: any of them, on a segment ending there.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param lines - The line ids.
 * @param cursor - The cursor.
 * @returns The question, for a station.
 */
const callingOf =
  (index: NetworkIndex, timeline: Timeline, lines: readonly LineId[], cursor: number) =>
  (station: StationId): boolean =>
    index.lineSegmentsAt(station).some(lineSegment => lines.includes(lineSegment.line) && timeline.callsAt(lineSegment, station, cursor));

/**
 * Whether a loop's stations, in order, go the way round its line goes, from how they turn on the map:
 * they sweep an area, positive going anticlockwise.
 *
 * @param index - The network.
 * @param stations - The loop's stations, the first again at its end.
 * @param way - The way its line goes.
 * @returns True if they do.
 */
const goesItsWay = (index: NetworkIndex, stations: StationId[], way: LoopWay): boolean => {
  let area = 0;
  for (const [place, station] of stations.entries()) {
    const [fromX, fromY] = index.coordOf(station);
    const [toX, toY] = index.coordOf(stations[place + 1] ?? station);
    area += fromX * toY - toX * fromY;
  }
  return area > 0 === (way === 'anticlockwise');
};

/**
 * A run the way its trains go: a loop closing where it began, of a line that says which way round
 * (`Line.way`), runs that way round and no other; anything else runs both ways, in its own order.
 *
 * @param index - The network.
 * @param way - The way its line goes, if it says.
 * @param run - The run's stations and the track between them.
 * @returns The run, turned round if it must be, and whether it is one way.
 */
const runningItsWay = (index: NetworkIndex, way: LoopWay | undefined, run: Pick<LineRun, 'stations' | 'track'>): Omit<LineRun, 'stops'> => {
  if (way === undefined || run.stations[0] !== run.stations.at(-1)) return { ...run, oneWay: false };
  if (goesItsWay(index, run.stations, way)) return { ...run, oneWay: true };
  return { stations: run.stations.toReversed(), track: run.track.toReversed(), oneWay: true };
};

/**
 * The longest run of track from a station over edges not yet listed, no station twice.
 *
 * @param graph - The line's graph.
 * @param start - Where the run starts.
 * @param used - Edges already listed.
 * @returns The run's stations and edges, and its length.
 */
const longestRun = (graph: LineGraph, start: StationId, used: Set<number>): { stations: StationId[]; edges: number[]; km: number } => {
  let best = { stations: [start], edges: [] as number[], km: 0 };
  const walk = (stations: StationId[], edges: number[], km: number) => {
    if (km > best.km) best = { stations, edges, km };
    const here = required(stations.at(-1), "a run's last station");
    for (const next of graph.get(here) ?? []) {
      if (used.has(next.edge) || stations.includes(next.to)) continue;
      walk([...stations, next.to], [...edges, next.edge], km + next.km);
    }
  };
  walk([start], [], 0);
  return best;
};

/**
 * Some lines' graph in the order they run, as runs of track: the longest first, end to end, then each
 * branch from the station it leaves, longest first. A loop is one run, from any station, closing where
 * it began; a loop one way, the way its line goes.
 *
 * @param index - The network.
 * @param track - The lines' graph, either way along every segment.
 * @param track.graph - The graph.
 * @param track.open - The line segments in it.
 * @param way - The way the lines go, if they say.
 * @param calls - Whether they call at a station.
 * @returns Each run.
 */
const runsOf = (
  index: NetworkIndex,
  { graph, open }: { graph: LineGraph; open: LineSegment[] },
  way: LoopWay | undefined,
  calls: (station: StationId) => boolean,
): LineRun[] => {
  const used = new Set<number>();
  const listed = new Set<StationId>();
  const runs: LineRun[] = [];
  while (used.size < open.length) {
    const unlisted = [...graph.keys()].filter(station => graph.get(station)?.some(next => !used.has(next.edge)));
    const ends = unlisted.filter(station => graph.get(station)?.length === 1);
    // A branch leaves from a station already listed; a first run (or a part not joined to it) from an
    // end; a loop from any of its stops.
    const joined = unlisted.filter(station => listed.has(station));
    const stops = unlisted.filter(calls);
    const starts = [joined, ends, stops].find(candidates => candidates.length > 0) ?? unlisted;
    // The longest run, the first of those as long.
    const run = required(
      starts.map(start => longestRun(graph, start, used)).toSorted((first, second) => second.km - first.km)[0],
      'a run from a station not yet listed',
    );
    for (const edge of run.edges) used.add(edge);
    // A loop closes where it began, or on itself (a line out to a loop and round it): the run says so.
    const last = required(run.stations.at(-1), "a run's last station");
    const closing = graph.get(last)?.find(next => !used.has(next.edge) && run.stations.includes(next.to));
    if (closing) {
      used.add(closing.edge);
      run.stations.push(closing.to);
      run.edges.push(closing.edge);
    }
    const isNew = run.stations.some(station => !listed.has(station) && calls(station));
    for (const station of run.stations) listed.add(station);
    // Track that adds no stop (a second track between two stations listed) is not a branch to show.
    if (!isNew) continue;
    const running = runningItsWay(index, way, { stations: run.stations, track: run.edges.map(edge => required(open[edge], `edge ${edge}`)) });
    // A branch's first station is kept, though listed (and though perhaps no stop): where it leaves from.
    runs.push({ ...running, stops: running.stations.filter((station, position) => (position === 0 && runs.length > 0) || calls(station)) });
  }
  return runs;
};

/**
 * The way one line says it goes; lines drawn as one have no way of their own.
 *
 * @param index - The network.
 * @param lines - The line ids.
 * @returns Its way, if it says.
 */
const wayOf = (index: NetworkIndex, lines: readonly LineId[]): LoopWay | undefined => {
  const [line, ...others] = lines;
  return line && others.length === 0 ? index.lineOf(line).way : undefined;
};

/**
 * A line in the order it runs, as runs of track (`runsOf`): one line, or those the map draws as one.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param lines - The line ids.
 * @param cursor - The cursor: the track open then.
 * @returns Each run: its stations and the track between them, in order, and its stops.
 */
export const lineRuns = (index: NetworkIndex, timeline: Timeline, lines: readonly LineId[], cursor: number): LineRun[] =>
  runsOf(index, lineGraph(index, timeline, lines, cursor), wayOf(index, lines), callingOf(index, timeline, lines, cursor));

/**
 * How long a line's open track is at a cursor.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param lines - The line ids: one line, or those the map draws as one.
 * @param cursor - The cursor.
 * @returns Its length, km.
 */
export const lineLengthKm = (index: NetworkIndex, timeline: Timeline, lines: readonly LineId[], cursor: number): number =>
  lineGraph(index, timeline, lines, cursor).open.reduce((total, { segment }) => total + segment.lengthKm, 0);

/**
 * The rides from a stop on a graph to the stops next along it, through any station its trains pass.
 *
 * @param graph - The line's graph, the way its trains go.
 * @param open - The line segments in it.
 * @param calls - Whether the line calls at a station.
 * @param start - The stop.
 * @returns Each ride.
 */
const hopsFrom = (graph: LineGraph, open: LineSegment[], calls: (station: StationId) => boolean, start: StationId): LineHop[] => {
  const hops: LineHop[] = [];
  const ride = (from: StationId, km: number, segments: number[], passed: StationId[]) => {
    for (const next of graph.get(from) ?? []) {
      if (passed.includes(next.to)) continue;
      const hop = { to: next.to, km: km + next.km, segments: [...segments, required(open[next.edge], `edge ${next.edge}`).segment.index] };
      if (calls(next.to)) hops.push(hop);
      else ride(next.to, hop.km, hop.segments, [...passed, next.to]);
    }
  };
  ride(start, 0, [], [start]);
  return hops;
};

/**
 * Where a line's trains go at a cursor, from each of its stops to the next, the way they go: both ways
 * along its track, but for a loop its line says the way round (`Line.way`).
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor: the track open then.
 * @returns The rides from each stop.
 */
export const lineHops = (index: NetworkIndex, timeline: Timeline, line: LineId, cursor: number): Map<StationId, LineHop[]> => {
  const { graph, open } = lineGraph(index, timeline, [line], cursor);
  const calls = callingOf(index, timeline, [line], cursor);
  const { way } = index.lineOf(line);
  for (const { stations, track, oneWay } of way ? runsOf(index, { graph, open }, way, calls) : []) {
    if (!oneWay) continue;
    for (const [place, lineSegment] of track.entries()) {
      // Within bounds: a run has a station past each stretch of its track.
      const to = stations[place + 1]!;
      graph.set(
        to,
        (graph.get(to) ?? []).filter(next => open[next.edge] !== lineSegment),
      );
    }
  }
  return new Map([...graph.keys()].filter(calls).map(station => [station, hopsFrom(graph, open, calls, station)]));
};

/**
 * Whether a step changes a line: opens or closes its track, opens or closes a station on it, or
 * changes how it is drawn.
 *
 * @param step - The step.
 * @param line - The line id.
 * @returns True if the step is part of the line's story.
 */
export const stepChangesLine = (step: Step, line: LineId): boolean => {
  if (step.kind === 'open' || step.kind === 'close') return step.line === line || step.lineSegments.some(lineSegment => lineSegment.line === line);
  if (step.kind === 'rename') return false;
  return step.lines.includes(line);
};

/**
 * A stop beside a station, and the end of the line beyond it, unless that is the stop itself.
 *
 * @param stop - The stop, if there is one.
 * @param end - The end of the line that way.
 * @returns The stop toward its end, or `null` for none.
 */
const toward = (stop: Stop | undefined, end: { name: string } | undefined): StopToward | null =>
  stop ? { id: stop.id, name: stop.name, towards: end && end.name !== stop.name ? end.name : null } : null;

/**
 * The stop one before and one after a station on a line, each with the end of the line that way,
 * as a platform's sign gives them: once for each run it is on, so a junction has a pair for each
 * branch. A branch's first stop is the station it leaves from, so from there a branch goes one way;
 * so does a one-way run, whose trains leave only for the stop after.
 *
 * @param station - The station's id.
 * @param runs - The line's runs on the date shown: their stops, and whether each runs one way.
 * @returns Each pair, in the line's order; none where the line does not call.
 */
export const directionsAt = (station: StationId, runs: { stops: Stop[]; oneWay: boolean }[]): LineDirection[] => {
  const found: LineDirection[] = [];
  for (const { stops, oneWay } of runs) {
    for (const [place, stop] of stops.entries()) {
      if (stop.id !== station) continue;
      const direction = { previous: oneWay ? null : toward(stops[place - 1], stops[0]), next: toward(stops[place + 1], stops.at(-1)) };
      const known = found.some(entry => entry.previous?.id === direction.previous?.id && entry.next?.id === direction.next?.id);
      if ((direction.previous || direction.next) && !known) found.push(direction);
    }
  }
  return found;
};
