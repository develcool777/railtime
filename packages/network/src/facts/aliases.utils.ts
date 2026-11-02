import type { Line, SegmentLine, Station, Suspension } from '@railtime/schema/network.types';

/**
 * Where each line drawn for a while as a line hidden (an alias) is first its own: the years it was
 * drawn as that line are that line's history, and go with it.
 *
 * @param lines - The network's lines.
 * @param hidden - The lines hidden.
 * @returns For each such line still shown, the day it is first drawn: its last alias to a line hidden ending.
 */
export const shownFromOf = (lines: Record<string, Line>, hidden: Set<string>): Map<string, string> =>
  new Map(
    Object.entries(lines).flatMap(([id, line]) => {
      if (hidden.has(id)) return [];
      const ends = (line.aliases ?? []).filter(alias => hidden.has(alias.as)).map(alias => alias.until);
      return ends.length > 0 ? [[id, ends.reduce((last, until) => (until > last ? until : last))] as const] : [];
    }),
  );

/**
 * A line drawn from a day on: its aliases ending before it gone.
 *
 * @param line - The line.
 * @param from - The day it is first drawn.
 * @returns The line, its aliases trimmed.
 */
export const lineFrom = (line: Line, from: string): Line => {
  const { aliases, ...own } = line;
  const left = (aliases ?? []).filter(alias => alias.until > from);
  return left.length > 0 ? { ...own, aliases: left } : own;
};

/**
 * Spells closed for a while from a day on: those over before it gone, one running over it from then.
 *
 * @param spells - The spells.
 * @param from - The day.
 * @returns The spells left, or none.
 */
const spellsFrom = (spells: Suspension[] | undefined, from: string): Suspension[] | undefined => {
  const left = (spells ?? []).filter(spell => spell.until > from).map(spell => (spell.from < from ? { ...spell, from } : spell));
  return left.length > 0 ? left : undefined;
};

/**
 * A line's run over a segment from a day on: opening then at the earliest, and none if it had closed by then.
 *
 * @param run - The line's run over the segment.
 * @param from - The day the line is first drawn.
 * @returns The run, or none.
 */
export const runFrom = (run: SegmentLine, from: string): SegmentLine | null => {
  if (run.close !== undefined && run.close <= from) return null;
  const { suspended, ...own } = run;
  const spells = spellsFrom(suspended, from);
  return { ...own, open: run.open < from ? from : run.open, ...(spells ? { suspended: spells } : {}) };
};

/**
 * A station with what it says of lines drawn only from a day on, from then: an opening on one before
 * it is the line's own opening; a closing on one before it leaves the line passing through, never
 * calling.
 *
 * @param station - The station.
 * @param shownFrom - Each line drawn only from a day on, and the day.
 * @returns The station.
 */
export const stationFrom = (station: Station, shownFrom: Map<string, string>): Station => {
  const fromOf = (line: string) => shownFrom.get(line) ?? '';
  const infill = Object.entries(station.infill ?? {}).filter(([line, day]) => day > fromOf(line));
  const closed = Object.entries(station.closed ?? {}).filter(([line, day]) => day > fromOf(line));
  const passing = Object.entries(station.closed ?? {}).flatMap(([line, day]) => (day <= fromOf(line) ? [line] : []));
  const suspended = Object.entries(station.suspended ?? {}).flatMap(([line, spells]) => {
    const left = shownFrom.has(line) ? spellsFrom(spells, fromOf(line)) : spells;
    return left ? [[line, left] as const] : [];
  });
  const passes = [...new Set([...(station.passes ?? []), ...passing])];
  const out: Station = { ...station };
  delete out.infill;
  delete out.closed;
  delete out.suspended;
  delete out.passes;
  return {
    ...out,
    ...(infill.length > 0 ? { infill: Object.fromEntries(infill) } : {}),
    ...(closed.length > 0 ? { closed: Object.fromEntries(closed) } : {}),
    ...(suspended.length > 0 ? { suspended: Object.fromEntries(suspended) } : {}),
    ...(passes.length > 0 ? { passes } : {}),
  };
};
