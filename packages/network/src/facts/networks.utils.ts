import type { Network, Station, Suspension } from '@railtime/schema/network.types';
import type { OptionalNetworkInfo } from './facts.types';

/**
 * The networks a city may show or leave off, by id.
 *
 * @param network - The network, as stored.
 * @returns Its optional networks' ids, in its order.
 */
const optionalIdsOf = (network: Network): string[] =>
  Object.entries(network.networks)
    .filter(([, info]) => info.optional)
    .map(([id]) => id);

/**
 * The optional networks asked for that a city has: an address may name any.
 *
 * @param network - The network, as stored.
 * @param asked - The ids asked for.
 * @returns Those it has, in its order.
 */
export const optionalNetworksAsked = (network: Network, asked: readonly string[]): string[] => optionalIdsOf(network).filter(id => asked.includes(id));

/**
 * A station with what it says of lines no longer there left out.
 *
 * @param station - The station.
 * @param kept - Whether a line is still there.
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
 * Where the timeline starts with some optional networks shown: the city's start, or an older one of theirs.
 *
 * @param network - The network, as stored.
 * @param shown - The optional networks shown.
 * @returns The earliest, as an ISO date.
 */
const startShown = (network: Network, shown: readonly string[]): string =>
  shown.reduce((start, id) => {
    const own = network.networks[id]?.start;
    return own && own < start ? own : start;
  }, network.meta.start);

/**
 * The network as shown: each optional network left off but those asked for, as if it were not there.
 * Its lines go, the track only they ran, the stations only they served and the changes to those; a
 * station only it served that a plan builds on is that plan's own, as it would be without it; a plan
 * building one of its lines goes with it. One shown that is older than the city starts the timeline
 * at its own start.
 *
 * @param network - The network, as stored.
 * @param shown - The optional networks to keep.
 * @returns The network shown; the one given where nothing is left off and nothing starts it earlier.
 */
export const withNetworksShown = (network: Network, shown: readonly string[]): Network => {
  const hidden = new Set(optionalIdsOf(network).filter(id => !shown.includes(id)));
  const start = startShown(network, shown);
  const meta = start === network.meta.start ? network.meta : { ...network.meta, start };
  if (hidden.size === 0) return meta === network.meta ? network : { ...network, meta };
  const lines = Object.fromEntries(Object.entries(network.lines).filter(([, line]) => !hidden.has(line.network)));
  const kept = (line: string): boolean => line in lines;
  const segments = network.segments.flatMap(segment => {
    const left = Object.entries(segment.lines).filter(([line]) => kept(line));
    return left.length > 0 ? [{ ...segment, lines: Object.fromEntries(left) }] : [];
  });
  const servedBefore = new Set(network.segments.flatMap(segment => [segment.stationA, segment.stationB]));
  const served = new Set(segments.flatMap(segment => [segment.stationA, segment.stationB]));
  const plans = Object.fromEntries(
    Object.entries(network.plans ?? {}).filter(([, plan]) => plan.sections.every(section => kept(section.line) || plan.lines?.[section.line])),
  );
  const gone = new Set([...servedBefore].filter(id => !served.has(id)));
  const stations = Object.fromEntries(
    Object.entries(network.stations)
      .filter(([id]) => !gone.has(id))
      .map(([id, station]) => [id, stationWithLines(station, kept)]),
  );
  // A plan's station that is gone becomes the plan's own: its place and name, none of its history.
  const plansShown = Object.fromEntries(
    Object.entries(plans).map(([id, plan]) => {
      const own = [...new Set(plan.sections.flatMap(section => section.stations))].filter(station => gone.has(station));
      if (own.length === 0) return [id, plan];
      const adopted = own.map(station => {
        // Within bounds: a station is gone only if the network had it.
        const { name, names, coordinate } = network.stations[station]!;
        return [station, { name, ...(names ? { names } : {}), coordinate }];
      });
      return [id, { ...plan, stations: { ...plan.stations, ...Object.fromEntries(adopted) } }];
    }),
  );
  return {
    ...network,
    meta,
    networks: Object.fromEntries(Object.entries(network.networks).filter(([id]) => !hidden.has(id))),
    lines,
    stations,
    segments,
    ...(network.transfers ? { transfers: network.transfers.filter(({ stationA, stationB }) => stationA in stations && stationB in stations) } : {}),
    ...(network.plans ? { plans: plansShown } : {}),
  };
};

/**
 * Each network a city may show or leave off, with its lines, for a list to turn it on.
 *
 * @param network - The network, as stored.
 * @param shown - The optional networks shown.
 * @returns Each, in the network's order.
 */
export const optionalNetworksOf = (network: Network, shown: readonly string[]): OptionalNetworkInfo[] =>
  Object.entries(network.networks)
    .filter(([, info]) => info.optional)
    .map(([id, info]) => ({
      id,
      name: info.name,
      shown: shown.includes(id),
      lines: Object.entries(network.lines)
        .filter(([, line]) => line.network === id && !line.pseudo)
        .map(([lineId, line]) => ({ id: lineId, name: line.name, color: { light: line.color, dark: line.darkColor ?? line.color } })),
    }));
