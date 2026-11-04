import { entriesOf } from '@railtime/core/collection.utils';
import { toTimestamp } from '@railtime/core/date.utils';
import type { Station, StationId } from '@railtime/schema/network.types';
import type { NetworkIndex } from './index.service';
import type { StationStops } from './stops.service';
import type { DayChanges } from './timeline.types';

/**
 * Gathers a station's own changes by their date: its openings on lines already there, its closings
 * for good and for a spell, and its names; and marks the lines that never call there.
 *
 * @param index - The network, indexed.
 * @param stops - Its stations' stops, where a line that never calls at one is marked.
 * @param station - The station id.
 * @param info - The station.
 * @param day - The changes of a day, made the first time asked for.
 */
const collectStationDays = (index: NetworkIndex, stops: StationStops, station: StationId, info: Station, day: (time: number) => DayChanges): void => {
  for (const [line, date] of entriesOf(info.infill ?? {})) {
    const time = toTimestamp(date);
    // A station opening where its line had already gone for good is no event: the line passed by before it.
    const lineLater = index.lineSegmentsAt(station).some(lineSegment => lineSegment.line === line && (lineSegment.closes ?? Infinity) > time);
    if (lineLater) day(time).infills.push({ station, line, reopening: false });
    else stops.stopOf(station, line).never = true;
  }
  for (const [line, date] of entriesOf(info.closed ?? {})) day(toTimestamp(date)).stationCloses.push({ station, line, temporary: false });
  for (const [line, spells] of entriesOf(info.suspended ?? {}))
    for (const { from, until } of spells) {
      day(toTimestamp(from)).stationCloses.push({ station, line, temporary: true });
      day(toTimestamp(until)).infills.push({ station, line, reopening: true });
    }
  for (const line of info.passes ?? []) stops.stopOf(station, line).never = true;
  for (const [position, former] of (info.formerNames ?? []).entries()) {
    const time = toTimestamp(former.until);
    // A name changed while no line runs there is no event: the station opens, or comes back, under the later name.
    const onMap = index.lineSegmentsAt(station).some(lineSegment => lineSegment.opens < time && (lineSegment.closes ?? Infinity) > time);
    if (!onMap) continue;
    day(time).renames.push({ station, from: former.name, to: info.formerNames?.[position + 1]?.name ?? info.name });
  }
};

/**
 * Gathers every change in the network by its date.
 *
 * @param index - The network, indexed.
 * @param stops - Its stations' stops, where a line that never calls at one is marked.
 * @returns The changes of each day, by timestamp.
 */
export const collectDays = (index: NetworkIndex, stops: StationStops): Map<number, DayChanges> => {
  const days = new Map<number, DayChanges>();
  const day = (time: number) => {
    if (!days.has(time)) days.set(time, { opens: [], closes: [], infills: [], stationCloses: [], renames: [], identities: [] });
    return days.get(time)!;
  };
  for (const lineSegment of index.lineSegments) {
    // A plan's are undated: `addPlannedSteps` takes them, section by section.
    if (lineSegment.section !== null) continue;
    day(lineSegment.opens).opens.push(lineSegment);
    if (lineSegment.closes !== null) day(lineSegment.closes).closes.push(lineSegment);
  }
  for (const [station, info] of entriesOf(index.network.stations)) collectStationDays(index, stops, station, info, day);
  for (const [line, info] of entriesOf(index.network.lines))
    for (const alias of info.aliases ?? []) {
      const time = toTimestamp(alias.until);
      // A line going out as its alias ends comes back as itself: no step says so.
      if (!index.goesOutAt(line, time)) day(time).identities.push({ line, text: alias.text });
    }
  return days;
};
