import type { NetworkStats } from '../model/facts.types.ts';
import type { DecadeOpenings, NetworkHistory, OpenNetwork, YearStats } from './history.types';
import type { NetworkIndex } from './index.service';
import type { Timeline } from './timeline.service';

/**
 * What is open at a cursor: the stations a line calls at (with those lines), the track, and the
 * lines as they are drawn.
 *
 * @param index - The network.
 * @param timeline - When each line opened, closed and called where.
 * @param cursor - The cursor.
 * @returns The stations with the lines calling at each, the segments and the lines open.
 */
export const networkAt = (index: NetworkIndex, timeline: Timeline, cursor: number): OpenNetwork => {
  const stations = new Map<string, Set<string>>();
  const segments = new Set<number>();
  const lines = new Set<string>();
  for (const lineSegment of index.lineSegments) {
    if (!timeline.isOpen(lineSegment, cursor)) continue;
    segments.add(lineSegment.segment.index);
    const drawnAs = timeline.identityOf(lineSegment.line, cursor).id;
    lines.add(drawnAs);
    for (const station of [lineSegment.segment.stationA, lineSegment.segment.stationB]) {
      if (timeline.servesStation(station, lineSegment.line, cursor)) stations.set(station, (stations.get(station) ?? new Set()).add(drawnAs));
    }
  }
  return { stations, segments, lines };
};

/**
 * The network's size at a cursor, counted as the map counts it with every line shown, but without
 * drawing it: cheap enough to take for every year.
 *
 * @param index - The network.
 * @param timeline - When each line opened, closed and called where.
 * @param cursor - The cursor.
 * @returns Its stations, km of track and lines.
 */
export const statsAt = (index: NetworkIndex, timeline: Timeline, cursor: number): NetworkStats => {
  const { stations, segments, lines } = networkAt(index, timeline, cursor);
  const km = [...segments].reduce((total, segment) => total + (index.segments[segment]?.lengthKm ?? 0), 0);
  return { stations: stations.size, km, lines: lines.size };
};

/**
 * The network at the end of each year, from the year of its start to `untilYear`, and the year each
 * station was first on the map. Plans have no date, so they are not in it.
 *
 * @param index - The network.
 * @param timeline - When each line opened, closed and called where.
 * @param untilYear - The last year to take: this year, for a history up to today.
 * @returns The years, and each station's first.
 */
export const networkHistory = (index: NetworkIndex, timeline: Timeline, untilYear: number): NetworkHistory => {
  const years: YearStats[] = [];
  const firstYears = new Map<string, number>();
  const startYear = new Date(timeline.start).getUTCFullYear();
  for (let year = startYear; year <= untilYear; year++) {
    const cursor = timeline.cursorAt(Date.UTC(year, 11, 31));
    const { stations, segments, lines } = networkAt(index, timeline, cursor);
    for (const station of stations.keys()) if (!firstYears.has(station)) firstYears.set(station, year);
    const km = [...segments].reduce((total, segment) => total + (index.segments[segment]?.lengthKm ?? 0), 0);
    years.push({ year, stations: stations.size, km, lines: lines.size });
  }
  return { years, firstYears };
};

/**
 * How many stations first opened in each decade, every decade from the first opening to the last
 * kept, one with none too.
 *
 * @param firstYears - The year each station was first on the map.
 * @returns The decades, earliest first.
 */
export const openingsByDecade = (firstYears: ReadonlyMap<string, number>): DecadeOpenings[] => {
  const counts = new Map<number, number>();
  for (const year of firstYears.values()) {
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  if (counts.size === 0) return [];
  const decades = [...counts.keys()];
  const openings: DecadeOpenings[] = [];
  for (let decade = Math.min(...decades); decade <= Math.max(...decades); decade += 10) openings.push({ decade, stations: counts.get(decade) ?? 0 });
  return openings;
};
