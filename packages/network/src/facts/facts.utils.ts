import { firstDifference, keysOf, pushTo } from '@railtime/core/collection.utils';
import { toTimestamp, yearOf } from '@railtime/core/date.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { cumulativeDistances } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import type { LineId, Network, PlanId, StationId } from '@railtime/schema/network.types';
import { buildPlan, firstPlanOf, isPlanOnly } from '@railtime/schema/plan.utils';
import { REACH_BANDS } from './facts.constants.ts';
import type { LineSketch, NetworkRecords, NetworkSummary, Playhead, PlanFacts, ReachedSegment, RecordsSource, StationLineInfo } from './facts.types';
import { networkAt } from '../engine/history.utils.ts';
import type { NetworkIndex } from '../engine/index.service';
import { lineLengthKm } from '../engine/lineDetails.utils.ts';
import type { Timeline } from '../engine/timeline.service';

/**
 * The length of a network's track.
 *
 * @param network - A network.
 * @returns Every segment's length, summed, km.
 */
const trackKm = (network: Network): number => network.segments.reduce((total, segment) => total + (cumulativeDistances(segment.coordinates).at(-1) ?? 0), 0);

/**
 * What a plan would add to its network, for its card.
 *
 * @param network - The city's network.
 * @param planId - One of its plans.
 * @returns Its new stations and track, and the lines it builds on.
 */
export const planFacts = (network: Network, planId: PlanId): PlanFacts => {
  const built = buildPlan(network, planId);
  const lineIds = [...new Set(built.sections.map(section => section.line))];
  return {
    stations: keysOf(network.plans?.[planId]?.stations ?? {}).length,
    // Splitting track for a new station keeps its length: what grows is the new track.
    km: Math.max(0, trackKm(built.network) - trackKm(network)),
    lines: lineIds.flatMap(id => {
      const line = built.network.lines[id];
      return line ? [{ id, name: line.name, color: { light: line.color, dark: line.darkColor ?? line.color } }] : [];
    }),
  };
};

/**
 * A network summed up, for a list of cities: its brands, when it began, how many plans, lines and
 * stations. A network never built is summed up by its first plan.
 *
 * @param network - The network.
 * @returns Its summary.
 */
export const networkSummary = (network: Network): NetworkSummary => {
  const planOnly = isPlanOnly(network);
  const first = firstPlanOf(network);
  const shown = planOnly && first !== undefined ? buildPlan(network, first).network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).toSorted(byCodeUnits)[0];
  return {
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? yearOf(toTimestamp(opened)) : null,
    planOnly,
    plans: keysOf(network.plans ?? {}).length,
    lines: Object.values(shown.lines).filter(line => !line.pseudo).length,
    stations: keysOf(shown.stations).length,
  };
};

/**
 * The track a sketch shows, each segment with its lines: what is open today, or for a network never
 * built, its first plan's.
 *
 * @param network - The network.
 * @returns Each segment's coordinates and line ids.
 */
const sketchedTrack = (network: Network): { coordinates: LngLat[]; lines: LineId[] }[] => {
  const openToday = network.segments.filter(segment => Object.values(segment.lines).some(dates => !dates.close));
  const first = firstPlanOf(network);
  if (openToday.length > 0 || first === undefined) return openToday.map(segment => ({ coordinates: segment.coordinates, lines: keysOf(segment.lines) }));
  const built = buildPlan(network, first);
  return built.sections.flatMap(section =>
    // Within bounds: a built section's segments are the built network's.
    section.segments.map(position => ({ coordinates: built.network.segments[position]!.coordinates, lines: [section.line] })),
  );
};

/**
 * A network at a glance: each line's track (a segment shared by several, its first line's), the
 * network's first line last, to lie on top; dashed for a network never built.
 *
 * @param network - The network.
 * @returns The track by line, bottom first.
 */
export const sketchOf = (network: Network): LineSketch[] => {
  const first = firstPlanOf(network);
  const lines = { ...network.lines, ...(first !== undefined && network.plans?.[first]?.lines) };
  const lineOrder = keysOf(lines);
  const dashed = isPlanOnly(network);
  const byLine = new Map<LineId, LngLat[][]>();
  for (const segment of sketchedTrack(network)) {
    const [first] = [...segment.lines].toSorted((one, other) => lineOrder.indexOf(one) - lineOrder.indexOf(other));
    if (first !== undefined) pushTo(byLine, first, segment.coordinates);
  }
  return [...byLine]
    .toSorted(([one], [other]) => lineOrder.indexOf(other) - lineOrder.indexOf(one))
    .map(([id, paths]) => {
      const line = required(lines[id], `line ${id}`);
      return { line: id, color: { light: line.color, dark: line.darkColor ?? line.color }, paths, dashed };
    });
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
  const { index, timeline, firstYears, colorOf } = source;
  const { stations } = networkAt(index, timeline, moment.cursor);
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
      lines: [...lines].toSorted(index.compareLines).map(line => ({ id: line, name: index.lineName(line), color: colorOf(line) })),
    }))
    .toSorted((first, second) => firstDifference(second.lines.length - first.lines.length, first.name.localeCompare(second.name)))
    .slice(0, count);
  const longest = index.lineIds
    .map(line => ({ id: line, name: index.lineName(line), color: colorOf(line), km: lineLengthKm(index, timeline, line, moment.cursor) }))
    .filter(line => line.km > 0)
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
 * Orders a station's lines by when they opened there, a plan's undated lines last.
 *
 * @param first - One line.
 * @param second - The other.
 * @returns Negative if the first comes first.
 */
export const byOpening = (first: StationLineInfo, second: StationLineInfo): number =>
  firstDifference((first.opened === null ? 1 : 0) - (second.opened === null ? 1 : 0), (first.opened ?? '').localeCompare(second.opened ?? ''));
