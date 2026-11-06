import { firstDifference, pushTo } from '@railtime/core/collection.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { required } from '@railtime/core/required.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { LineId, Plan, StationId } from '@railtime/schema/network.types';
import type { BuiltPlan } from '@railtime/schema/plan.types';
import { REACH_BANDS } from './facts.constants.ts';
import type { LineInfo, LineSketch, NetworkRecords, Playhead, PlanFacts, ReachedSegment, StationLineInfo } from './facts.types';
import type { DatedLine, RecordsSource } from './moment.types';
import { networkAt } from '../engine/history.utils.ts';
import type { NetworkIndex } from '../engine/index.service';
import { lineColorOf } from '../engine/lineColor.utils.ts';
import { lineLengthKm } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';

/**
 * What a plan would add to its network, for its card.
 *
 * @param plan - The plan.
 * @param built - The plan built on the network: its track, and its lines.
 * @param onMap - The stations on the map today, each with the lines calling there.
 * @returns The stations its sections reach that no line calls at today, the track it lays, and the lines it builds on.
 */
export const planFacts = (plan: Plan, built: BuiltPlan, onMap: ReadonlyMap<StationId, unknown>): PlanFacts => {
  const reached = new Set(plan.sections.flatMap(section => section.stations));
  return {
    stations: [...reached].filter(station => !onMap.has(station)).length,
    km: built.laidKm,
    lines: [...new Set(built.sections.map(section => section.line))].map(id => {
      const line = required(built.network.lines[id], `line ${id}`);
      return { id, name: line.name, color: lineColorOf(line) };
    }),
  };
};

/**
 * A line as a list shows it, whatever it is drawn as.
 *
 * @param index - The network, indexed.
 * @param id - The line id.
 * @returns The line.
 */
export const lineInfoOf = (index: NetworkIndex, id: LineId): LineInfo => {
  const line = index.lineOf(id);
  const opens = index.lineOpens(id);
  return {
    id,
    name: line.name,
    network: line.network,
    networkName: required(index.network.networks[line.network], `network ${line.network}`).name,
    color: index.colorOf(id),
    opened: Number.isFinite(opens) ? opens : null,
  };
};

/**
 * A network at a glance, as it stands at a cursor: each line's track as the map draws it (a segment
 * shared by several, its first line's), the network's first line last, to lie on top.
 *
 * @param index - The network, indexed.
 * @param timeline - Its history.
 * @param cursor - The cursor.
 * @param dashed - Whether it is drawn dashed.
 * @returns The track by line, bottom first.
 */
export const sketchOf = (index: NetworkIndex, timeline: Timeline, cursor: number, dashed: boolean): LineSketch[] => {
  const firstLines = new Map<number, LineId>();
  for (const lineSegment of index.lineSegments) {
    if (!timeline.isOpen(lineSegment, cursor)) continue;
    const drawn = timeline.drawnAs(lineSegment.line, cursor);
    const known = firstLines.get(lineSegment.segment.index);
    if (known === undefined || index.compareLines(drawn, known) < 0) firstLines.set(lineSegment.segment.index, drawn);
  }
  const byLine = new Map<LineId, LngLat[][]>();
  // Within bounds: each key is a segment's index.
  for (const [segment, line] of firstLines) pushTo(byLine, line, index.segments[segment]!.coordinates);
  return [...byLine].toSorted(([one], [other]) => index.compareLines(other, one)).map(([line, paths]) => ({ line, color: index.colorOf(line), paths, dashed }));
};

/**
 * The band a time falls in: the last has no end, so every time finds one.
 *
 * @param minutes - How long it takes.
 * @returns The band's place in `REACH_BANDS`.
 */
export const bandOf = (minutes: number): number => REACH_BANDS.findIndex(entry => entry.upTo === null || minutes <= entry.upTo);

/**
 * The track a reach colours: each segment with a reached station at an end, timed as the mean of its
 * ends' times, or the one end's when only one is reached (a station its lines pass by).
 *
 * @param minutes - Minutes to each station reached, by id, the start's included.
 * @param segments - The segments open on the date, each once.
 * @param segments.index - The segment's id.
 * @param segments.stationA - One end.
 * @param segments.stationB - The other end.
 * @returns The segments reached, with their times.
 */
export const reachedSegments = (
  minutes: ReadonlyMap<StationId, number>,
  segments: Iterable<{ index: number; stationA: StationId; stationB: StationId }>,
): ReachedSegment[] => {
  const reached: ReachedSegment[] = [];
  for (const segment of segments) {
    const ends = [minutes.get(segment.stationA), minutes.get(segment.stationB)].filter((time): time is number => time !== undefined);
    if (ends.length > 0) reached.push({ segment: segment.index, minutes: ends.reduce((total, time) => total + time, 0) / ends.length });
  }
  return reached;
};

/**
 * The network's records at a moment: the stations open longest, those most lines call at, and the
 * longest lines.
 *
 * @param source - The network, its history and its lines' colours.
 * @param count - How many of each.
 * @param moment - The moment.
 * @returns The records.
 */
export const recordsOf = (source: RecordsSource, count: number, moment: Playhead): NetworkRecords => {
  const { index, timeline, firstYears } = source;
  const { stations, lines: drawn } = networkAt(index, timeline, moment.cursor);
  const name = (station: StationId) => index.stationName(station, moment.time);
  const oldest = [...stations.keys()]
    .flatMap(station => {
      const year = firstYears.get(station);
      return year === undefined ? [] : [{ id: station, name: name(station), year }];
    })
    .toSorted((first, second) => firstDifference(first.year - second.year, first.name.localeCompare(second.name)))
    .slice(0, count);
  const busiest = [...stations]
    .map(([station, lines]) => ({
      id: station,
      name: name(station),
      lines: [...lines].toSorted(index.compareLines).map(line => ({ id: line, name: index.lineName(line), color: index.colorOf(line) })),
    }))
    .toSorted((first, second) => firstDifference(second.lines.length - first.lines.length, first.name.localeCompare(second.name)))
    .slice(0, count);
  const longest = [...drawn]
    .toSorted(index.compareLines)
    .map(line => ({
      id: line,
      name: index.lineName(line),
      color: index.colorOf(line),
      km: lineLengthKm(index, timeline, timeline.linesDrawnAs(line, moment.cursor), moment.cursor),
    }))
    .toSorted((first, second) => second.km - first.km)
    .slice(0, count);
  return { oldest, busiest, longest };
};

/**
 * When each line calling at a station opened its track there, and closed it: the first opening, the
 * last closing, and whether every one of its segments there has closed.
 *
 * @param index - The network, indexed.
 * @param timeline - Its history.
 * @param station - The station.
 * @returns Each line's dates there, as timestamps: `Infinity` opened for a plan's undated line.
 */
export const trackDatesAt = (
  index: NetworkIndex,
  timeline: Timeline,
  station: StationId,
): Map<LineId, { opened: number; lastClosed: number; allClosed: boolean }> => {
  const byLine = new Map<LineId, { opened: number; lastClosed: number; allClosed: boolean }>();
  for (const lineSegment of index.lineSegmentsAt(station)) {
    if (!timeline.everServes(station, lineSegment.line)) continue;
    // Timestamps before 1970 are negative: the latest close starts below any of them.
    const dates = byLine.get(lineSegment.line) ?? { opened: Infinity, lastClosed: -Infinity, allClosed: true };
    dates.opened = Math.min(dates.opened, lineSegment.opens);
    dates.lastClosed = Math.max(dates.lastClosed, lineSegment.closes ?? -Infinity);
    // A line has closed at a station only when every one of its segments there has.
    dates.allClosed &&= lineSegment.closes !== null;
    byLine.set(lineSegment.line, dates);
  }
  return byLine;
};

/**
 * A station's lines as the map draws them at a moment: lines drawn as one are one, opening with the
 * first of them, and closed once all of them are, with the last.
 *
 * @param dated - Each line's dates there, with what it is drawn as.
 * @returns Each line as drawn, once.
 */
export const linesAsDrawn = (dated: DatedLine[]): DatedLine[] => {
  const byLine = new Map<LineId, DatedLine[]>();
  for (const line of dated) pushTo(byLine, line.drawn, line);
  return [...byLine].map(([drawn, lines]) => {
    const closings = lines.flatMap(line => line.closed ?? []).toSorted(byCodeUnits);
    return {
      drawn,
      opened: lines.flatMap(line => line.opened ?? []).toSorted(byCodeUnits)[0] ?? null,
      closed: closings.length === lines.length ? closings.at(-1) : undefined,
    };
  });
};

/**
 * Orders a station's lines by when they opened there, a plan's undated lines last.
 *
 * @param first - One line.
 * @param second - The other.
 * @returns Negative if the first comes first.
 */
export const byOpening = (first: StationLineInfo, second: StationLineInfo): number =>
  firstDifference((first.opened === null ? 1 : 0) - (second.opened === null ? 1 : 0), (first.opened ?? '').localeCompare(second.opened ?? ''));
