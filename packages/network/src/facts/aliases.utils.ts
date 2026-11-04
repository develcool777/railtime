import { entriesOf, fromEntriesOf } from '@railtime/core/collection.utils';
import type { IsoDate } from '@railtime/core/date.types';
import { toIsoDate, toTimestamp } from '@railtime/core/date.utils';
import type { Line, LineId, SegmentLine, Station, Suspension } from '@railtime/schema/network.types';
import type { LineGap } from '../engine/engine.types';
import { outsideGaps } from '../engine/gaps.utils.ts';

/**
 * The years each line still shown was drawn as a line hidden (an alias): that line's history, which
 * goes with it. An alias runs from the one before it ends, or from the start, to its own end.
 *
 * @param lines - The network's lines.
 * @param hidden - The lines hidden.
 * @returns Each line shown with any, its gaps in order.
 */
export const gapsOf = (lines: Record<LineId, Line>, hidden: Set<LineId>): Map<LineId, LineGap[]> =>
  new Map(
    entriesOf(lines).flatMap(([id, line]) => {
      if (hidden.has(id)) return [];
      const aliases = [...(line.aliases ?? [])].toSorted((first, second) => first.until.localeCompare(second.until));
      const gaps = aliases.flatMap((alias, position) => {
        if (!hidden.has(alias.as)) return [];
        const before = aliases[position - 1];
        return [{ from: before ? toTimestamp(before.until) : -Infinity, until: toTimestamp(alias.until) }];
      });
      return gaps.length > 0 ? [[id, gaps] as const] : [];
    }),
  );

/**
 * A line without its aliases to lines hidden: the years they ran are its gaps.
 *
 * @param line - The line.
 * @param hidden - The lines hidden.
 * @returns The line, its aliases trimmed.
 */
export const lineWithout = (line: Line, hidden: Set<LineId>): Line => {
  const { aliases, ...own } = line;
  const left = (aliases ?? []).filter(alias => !hidden.has(alias.as));
  if (left.length === (aliases ?? []).length) return line;
  return left.length > 0 ? { ...own, aliases: left } : own;
};

/**
 * Whether anything is left of a line's run over a segment outside its gaps: the engine cuts what is.
 *
 * @param run - The run.
 * @param gaps - The line's gaps.
 * @returns True if some of it is outside them.
 */
export const runsOutside = (run: SegmentLine, gaps: readonly LineGap[]): boolean =>
  outsideGaps(toTimestamp(run.open), run.close ? toTimestamp(run.close) : null, gaps).length > 0;

/**
 * Spells closed for a while outside a line's gaps: cut at each.
 *
 * @param spells - The spells.
 * @param gaps - The line's gaps.
 * @returns The spells left, in order.
 */
const spellsOutside = (spells: Suspension[], gaps: readonly LineGap[]): Suspension[] =>
  spells.flatMap(spell =>
    outsideGaps(toTimestamp(spell.from), toTimestamp(spell.until), gaps).map(piece => ({
      from: toIsoDate(piece.opens),
      // Within bounds: a piece of a spell ends where the spell or a gap does.
      until: toIsoDate(piece.closes!),
    })),
  );

/**
 * The gap a day falls in, if any.
 *
 * @param day - The day, as an ISO date.
 * @param gaps - A line's gaps.
 * @returns The gap.
 */
const gapAt = (day: IsoDate, gaps: readonly LineGap[]): LineGap | undefined => {
  const time = toTimestamp(day);
  return gaps.find(gap => gap.from <= time && time < gap.until);
};

/**
 * A station with what it says of lines with gaps outside them: a line opening there in one opens there
 * as it is back; one closing there in one closes as it goes, or, gone from the start, never calls
 * there; its spells closed are cut at each.
 *
 * @param station - The station.
 * @param gaps - Each line's gaps.
 * @returns The station.
 */
export const stationOutside = (station: Station, gaps: ReadonlyMap<LineId, readonly LineGap[]>): Station => {
  const lines = [...gaps.keys()].filter(line => (station.infill?.[line] ?? station.closed?.[line] ?? station.suspended?.[line]) !== undefined);
  if (lines.length === 0) return station;
  const gapsOfLine = (line: LineId) => gaps.get(line) ?? [];
  const infill = entriesOf(station.infill ?? {}).map(([line, day]): [LineId, IsoDate] => {
    const gap = gapAt(day, gapsOfLine(line));
    return [line, gap ? toIsoDate(gap.until) : day];
  });
  const closings = entriesOf(station.closed ?? {}).map(([line, day]) => [line, day, gapAt(day, gapsOfLine(line))] as const);
  const closed = closings.flatMap(([line, day, gap]): [LineId, IsoDate][] => {
    if (!gap) return [[line, day]];
    return Number.isFinite(gap.from) ? [[line, toIsoDate(gap.from)]] : [];
  });
  const passing = closings.flatMap(([line, , gap]) => (gap && !Number.isFinite(gap.from) ? [line] : []));
  const suspended = entriesOf(station.suspended ?? {}).flatMap(([line, spells]) => {
    const left = spellsOutside(spells, gapsOfLine(line));
    return left.length > 0 ? [[line, left] as const] : [];
  });
  const passes = [...new Set([...(station.passes ?? []), ...passing])];
  const out: Station = { ...station };
  delete out.infill;
  delete out.closed;
  delete out.suspended;
  delete out.passes;
  return {
    ...out,
    ...(infill.length > 0 && { infill: fromEntriesOf(infill) }),
    ...(closed.length > 0 && { closed: fromEntriesOf(closed) }),
    ...(suspended.length > 0 && { suspended: fromEntriesOf(suspended) }),
    ...(passes.length > 0 && { passes }),
  };
};
