import type { Line, Network, Plan, Segment, Station, Suspension } from '@railtime/schema/network.types';
import { gapsOf, lineWithout, runsOutside, stationOutside } from './aliases.utils.ts';
import type { NetworkChoice, ShownNetwork } from './facts.types';
import type { LineGap } from '../engine/engine.types';

/**
 * The lines a person may show or hide: every line of the network but those that exist only to be
 * drawn as (pseudo lines).
 *
 * @param network - The network, as stored.
 * @returns Their ids, in its order.
 */
const toggleableOf = (network: Network): string[] =>
  Object.entries(network.lines)
    .filter(([, line]) => !line.pseudo)
    .map(([id]) => id);

/**
 * The lines some ids name: a line by its own id, every line of a network by the network's.
 *
 * @param network - The network, as stored.
 * @param ids - Ids of lines or networks; those it does not have name nothing.
 * @returns The lines, in its order.
 */
export const linesNamed = (network: Network, ids: readonly string[]): string[] =>
  // Within bounds: each id is one of the network's lines.
  toggleableOf(network).filter(id => ids.includes(id) || ids.includes(network.lines[id]!.network));

/**
 * The lines hidden when a city opens: those of its networks hidden at first.
 *
 * @param network - The network, as stored.
 * @returns Their ids, in its order.
 */
export const linesHiddenAtFirst = (network: Network): string[] =>
  linesNamed(
    network,
    Object.entries(network.networks)
      .filter(([, info]) => info.hidden)
      .map(([id]) => id),
  );

/**
 * A station with what it says of lines no longer drawn left out.
 *
 * @param station - The station.
 * @param kept - Whether a line is still drawn.
 * @returns The station, its per-line notes trimmed.
 */
const stationWithLines = (station: Station, kept: (line: string) => boolean): Station => {
  const byLine = (record: Record<string, string> | undefined) => {
    const left = Object.entries(record ?? {}).filter(([line]) => kept(line));
    return left.length > 0 ? Object.fromEntries(left) : undefined;
  };
  const spellsByLine = (record: Record<string, Suspension[]> | undefined) => {
    const left = Object.entries(record ?? {}).filter(([line]) => kept(line));
    return left.length > 0 ? Object.fromEntries(left) : undefined;
  };
  const listed = (lines: string[] | undefined) => {
    const left = (lines ?? []).filter(kept);
    return left.length > 0 ? left : undefined;
  };
  const { infill, closed, suspended, passes, reverses, ...rest } = station;
  const trimmed = { infill: byLine(infill), closed: byLine(closed), suspended: spellsByLine(suspended), passes: listed(passes), reverses: listed(reverses) };
  return { ...rest, ...Object.fromEntries(Object.entries(trimmed).filter(([, value]) => value !== undefined)) };
};

/**
 * The lines left with some hidden: those drawn, without their aliases to lines hidden, and the pseudo
 * lines one of them is still drawn as.
 *
 * @param network - The network, as stored.
 * @param hidden - The lines hidden.
 * @returns The lines, in its order.
 */
const linesLeft = (network: Network, hidden: Set<string>): Record<string, Line> => {
  const drawn = Object.entries(network.lines).flatMap(([id, line]): [string, Line][] =>
    line.pseudo || hidden.has(id) ? [] : [[id, lineWithout(line, hidden)]],
  );
  const drawnAs = new Set(drawn.flatMap(([, line]) => (line.aliases ?? []).map(alias => alias.as)));
  const kept = new Map([...drawn, ...Object.entries(network.lines).filter(([id, line]) => line.pseudo && drawnAs.has(id))]);
  // In the network's order.
  return Object.fromEntries(
    Object.keys(network.lines).flatMap((id): [string, Line][] => {
      const line = kept.get(id);
      return line ? [[id, line]] : [];
    }),
  );
};

/**
 * Whether two pieces of track join the same two stations, either way round.
 *
 * @param first - One: its two stations.
 * @param second - The other.
 * @returns True if they do.
 */
const samePair = (first: Pick<Segment, 'stationA' | 'stationB'>, second: Pick<Segment, 'stationA' | 'stationB'>): boolean =>
  (first.stationA === second.stationA && first.stationB === second.stationB) || (first.stationA === second.stationB && first.stationB === second.stationA);

/**
 * Whether one of a plan's sections links a segment's two stations, one after the other.
 *
 * @param plan - The plan.
 * @param segment - The segment.
 * @returns True if one does.
 */
const linksStations = (plan: Plan, segment: Segment): boolean =>
  plan.sections.some(section =>
    section.stations.some((station, index) => index > 0 && samePair({ stationA: section.stations[index - 1]!, stationB: station }, segment)),
  );

/**
 * Where the timeline starts with some lines hidden: the city's start, or an older one of a network
 * one of its lines drawn is in.
 *
 * @param network - The network, as stored.
 * @param drawn - Whether a line is drawn.
 * @returns The earliest, as an ISO date.
 */
const startShown = (network: Network, drawn: (line: string) => boolean): string => {
  let start = network.meta.start;
  for (const [id, line] of Object.entries(network.lines)) {
    const own = drawn(id) ? network.networks[line.network]?.start : undefined;
    if (own && own < start) start = own;
  }
  return start;
};

/**
 * The network with some lines hidden, as if they were not there: their track, the stations only they
 * served and the changes to those go, and the years another line was drawn as one of them (an alias),
 * its gaps, which the engine cuts its runs at; a station only they served that a plan builds on is
 * that plan's own, as it would be without them, and so is their track between two stations a plan's
 * section links, so the plan runs where they ran; a plan keeps its sections on lines still drawn, its
 * stations only those use, and goes once it has none. A network older than the city starts the
 * timeline at its own start while one of its lines shows.
 *
 * @param network - The network, as stored.
 * @param hidden - The lines hidden.
 * @returns The network shown, the one given where nothing is hidden and nothing starts it earlier, and each line's gaps.
 */
export const withLinesHidden = (network: Network, hidden: readonly string[]): ShownNetwork => {
  const hiddenSet = new Set(hidden);
  // A pseudo line has no track of its own: drawn are the lines not hidden.
  const drawn = (line: string): boolean => !hiddenSet.has(line) && network.lines[line]?.pseudo !== true;
  const start = startShown(network, drawn);
  const meta = start === network.meta.start ? network.meta : { ...network.meta, start };
  if (hiddenSet.size === 0) return { network: meta === network.meta ? network : { ...network, meta }, gaps: new Map() };
  const lines = linesLeft(network, hiddenSet);
  const gaps = gapsOf(network.lines, hiddenSet);
  const gapsOfLine = (line: string): readonly LineGap[] => gaps.get(line) ?? [];
  const runsLeft = (segment: Segment) => Object.entries(segment.lines).filter(([line, run]) => drawn(line) && runsOutside(run, gapsOfLine(line)));
  const segments = network.segments.flatMap(segment => {
    const left = runsLeft(segment);
    return left.length > 0 ? [{ ...segment, lines: Object.fromEntries(left) }] : [];
  });
  const trackGone = network.segments.filter(segment => runsLeft(segment).length === 0);
  const servedBefore = new Set(network.segments.flatMap(segment => [segment.stationA, segment.stationB]));
  const served = new Set(segments.flatMap(segment => [segment.stationA, segment.stationB]));
  const gone = servedBefore.difference(served);
  const plans = Object.fromEntries(
    Object.entries(network.plans ?? {}).flatMap(([id, plan]): [string, Plan][] => {
      const sections = plan.sections.filter(section => drawn(section.line) || plan.lines?.[section.line] !== undefined);
      if (sections.length === 0) return [];
      if (sections.length === plan.sections.length) return [[id, plan]];
      // A station of the plan's own that only the sections left out reach goes with them.
      const reached = new Set(sections.flatMap(section => section.stations));
      const stations = Object.entries(plan.stations ?? {}).filter(([station]) => reached.has(station));
      const transfers = plan.transfers?.filter(({ stationA, stationB }) =>
        [stationA, stationB].every(station => reached.has(station) || (station in network.stations && !gone.has(station))),
      );
      return [[id, { ...plan, sections, stations: Object.fromEntries(stations), ...(transfers && { transfers }) }]];
    }),
  );
  const stations = Object.fromEntries(
    Object.entries(network.stations)
      .filter(([id]) => !gone.has(id))
      .map(([id, station]) => [id, stationOutside(stationWithLines(station, drawn), gaps)]),
  );
  // A plan's station that is gone becomes the plan's own: its place and name, none of its history; and
  // so does track gone between two stations a section links, where the plan says none: it runs there still.
  const plansShown = Object.fromEntries(
    Object.entries(plans).map(([id, plan]): [string, Plan] => {
      const own = [...new Set(plan.sections.flatMap(section => section.stations.filter(station => gone.has(station))))];
      const track = trackGone.filter(segment => linksStations(plan, segment) && !plan.track?.some(given => samePair(given, segment)));
      if (own.length === 0 && track.length === 0) return [id, plan];
      const adopted = own.map(station => {
        // Within bounds: a station is gone only if the network had it.
        const { name, names, coordinate } = network.stations[station]!;
        return [station, { name, ...(names && { names }), coordinate }] as const;
      });
      const ownTrack = track.map(({ stationA, stationB, coordinates }) => ({ stationA, stationB, coordinates }));
      return [
        id,
        {
          ...plan,
          stations: { ...plan.stations, ...Object.fromEntries(adopted) },
          ...(ownTrack.length > 0 && { track: [...(plan.track ?? []), ...ownTrack] }),
        },
      ];
    }),
  );
  const networksUsed = new Set(
    [...Object.values(lines), ...Object.values(plansShown).flatMap(plan => Object.values(plan.lines ?? {}))].map(line => line.network),
  );
  return {
    network: {
      ...network,
      meta,
      networks: Object.fromEntries(Object.entries(network.networks).filter(([id]) => networksUsed.has(id))),
      lines,
      stations,
      segments,
      ...(network.transfers && { transfers: network.transfers.filter(({ stationA, stationB }) => stationA in stations && stationB in stations) }),
      ...(network.plans && { plans: plansShown }),
    },
    gaps,
  };
};

/**
 * Each network with the lines a person may show or hide, for a list to do it.
 *
 * @param network - The network, as stored.
 * @param hidden - The lines hidden.
 * @returns Each network with one, in the network's order.
 */
export const networkChoicesOf = (network: Network, hidden: readonly string[]): NetworkChoice[] =>
  Object.entries(network.networks).flatMap(([id, info]) => {
    const lines = Object.entries(network.lines)
      .filter(([, line]) => line.network === id && !line.pseudo)
      .map(([lineId, line]) => ({
        id: lineId,
        name: line.name,
        color: { light: line.color, dark: line.darkColor ?? line.color },
        shown: !hidden.includes(lineId),
      }));
    return lines.length > 0 ? [{ id, name: info.name, lines }] : [];
  });
