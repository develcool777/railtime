import type { LineDetails, LineDirection, StopToward } from '../model/facts.types';
import type { NetworkIndex } from './index.service';
import type { LineSegment } from './index.types';
import type { Timeline } from './timeline.service';
import type { Step } from './timeline.types';

/** A line's track at a cursor, as a graph: each station's neighbours on it, with the km between. */
type LineGraph = Map<string, { to: string; km: number; edge: number }[]>;

/**
 * A line's open track at a cursor, as a graph of stations.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor.
 * @returns The graph, and the line segments in it.
 */
const lineGraph = (index: NetworkIndex, timeline: Timeline, line: string, cursor: number): { graph: LineGraph; open: LineSegment[] } => {
  const open = index.lineSegments.filter(lineSegment => lineSegment.line === line && timeline.isOpen(lineSegment, cursor));
  const graph: LineGraph = new Map();
  for (const [edge, { segment }] of open.entries()) {
    const link = (from: string, to: string) => graph.set(from, [...(graph.get(from) ?? []), { to, km: segment.lengthKm, edge }]);
    link(segment.stationA, segment.stationB);
    link(segment.stationB, segment.stationA);
  }
  return { graph, open };
};

/**
 * The longest run of track from a station over edges not yet listed, no station twice.
 *
 * @param graph - The line's graph.
 * @param start - Where the run starts.
 * @param used - Edges already listed.
 * @returns The run's stations and edges, and its length.
 */
const longestRun = (graph: LineGraph, start: string, used: Set<number>): { stations: string[]; edges: number[]; km: number } => {
  let best = { stations: [start], edges: [] as number[], km: 0 };
  const walk = (stations: string[], edges: number[], km: number) => {
    if (km > best.km) best = { stations, edges, km };
    // Within bounds: a run is never empty.
    const here = stations[stations.length - 1]!;
    for (const next of graph.get(here) ?? []) {
      if (used.has(next.edge) || stations.includes(next.to)) continue;
      walk([...stations, next.to], [...edges, next.edge], km + next.km);
    }
  };
  walk([start], [], 0);
  return best;
};

/**
 * A line's stations in the order it runs, as runs of track: the longest first, end to end, then
 * each branch from the station it leaves, longest first. A loop is one run, from any station.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor: the track open then.
 * @returns Each run's stations, the line's stops only; a branch's first is the station it leaves from.
 */
export const lineBranches = (index: NetworkIndex, timeline: Timeline, line: string, cursor: number): string[][] => {
  const { graph, open } = lineGraph(index, timeline, line, cursor);
  const serves = (station: string) => timeline.servesStation(station, line, cursor);
  const used = new Set<number>();
  const listed = new Set<string>();
  const runs: string[][] = [];
  while (used.size < open.length) {
    const unlisted = [...graph.keys()].filter(station => graph.get(station)?.some(next => !used.has(next.edge)));
    const ends = unlisted.filter(station => graph.get(station)?.length === 1);
    // A branch leaves from a station already listed; a first run (or a part not joined to it) from an
    // end; a loop from any of its stops.
    const joined = unlisted.filter(station => listed.has(station));
    const stops = unlisted.filter(serves);
    const starts = [joined, ends, stops].find(candidates => candidates.length > 0) ?? unlisted;
    const run = starts.map(start => longestRun(graph, start, used)).reduce((best, candidate) => (candidate.km > best.km ? candidate : best));
    for (const edge of run.edges) used.add(edge);
    // A loop closes where it began, or on itself (a line out to a loop and round it): the run says so.
    const last = run.stations[run.stations.length - 1] ?? '';
    const closing = graph.get(last)?.find(next => !used.has(next.edge) && run.stations.includes(next.to));
    if (closing) {
      used.add(closing.edge);
      run.stations.push(closing.to);
    }
    const isNew = run.stations.some(station => !listed.has(station) && serves(station));
    for (const station of run.stations) listed.add(station);
    // Track that adds no stop (a second track between two stations listed) is not a branch to show.
    if (!isNew) continue;
    // A branch's first station is kept, though listed (and though perhaps no stop): where it leaves from.
    runs.push(run.stations.filter((station, position) => (position === 0 && runs.length > 0) || serves(station)));
  }
  return runs;
};

/**
 * How long a line's open track is at a cursor.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param line - The line id.
 * @param cursor - The cursor.
 * @returns Its length, km.
 */
export const lineLengthKm = (index: NetworkIndex, timeline: Timeline, line: string, cursor: number): number =>
  lineGraph(index, timeline, line, cursor).open.reduce((total, { segment }) => total + segment.lengthKm, 0);

/**
 * Whether a step changes a line: opens or closes its track, opens or closes a station on it, or
 * changes how it is drawn.
 *
 * @param step - The step.
 * @param line - The line id.
 * @returns True if the step is part of the line's story.
 */
export const stepChangesLine = (step: Step, line: string): boolean => {
  if (step.kind === 'open' || step.kind === 'close') return step.line === line || step.lineSegments.some(lineSegment => lineSegment.line === line);
  if (step.kind === 'rename') return false;
  return step.lines.includes(line);
};

/**
 * The stop one before and one after a station on a line, each with the end of the line that way,
 * as a platform's sign gives them: once for each run it is on, so a junction has a pair for each
 * branch. A branch's first stop is the station it leaves from, so from there a branch goes one way.
 *
 * @param station - The station's id.
 * @param line - The line on the date shown, with its stops.
 * @returns Each pair, in the line's order; none where the line does not call.
 */
export const directionsAt = (station: string, line: LineDetails): LineDirection[] => {
  const found: LineDirection[] = [];
  const toward = (stop: { id: string; name: string } | undefined, end: { name: string } | undefined): StopToward | null =>
    stop ? { id: stop.id, name: stop.name, towards: end && end.name !== stop.name ? end.name : null } : null;
  for (const run of line.branches) {
    run.forEach((stop, place) => {
      if (stop.id !== station) return;
      const direction = { previous: toward(run[place - 1], run[0]), next: toward(run[place + 1], run.at(-1)) };
      const known = found.some(entry => entry.previous?.id === direction.previous?.id && entry.next?.id === direction.next?.id);
      if ((direction.previous || direction.next) && !known) found.push(direction);
    });
  }
  return found;
};
