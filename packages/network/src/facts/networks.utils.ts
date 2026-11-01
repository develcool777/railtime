import type { Network, Station } from '@railtime/schema/network.types';
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
  const listed = (lines: string[] | undefined) => {
    const left = (lines ?? []).filter(kept);
    return left.length > 0 ? left : undefined;
  };
  const { infill, closed, passes, reverses, ...rest } = station;
  const trimmed = { infill: byLine(infill), closed: byLine(closed), passes: listed(passes), reverses: listed(reverses) };
  return { ...rest, ...Object.fromEntries(Object.entries(trimmed).filter(([, value]) => value !== undefined)) };
};

/**
 * The network as shown: each optional network left off but those asked for, as if it were not there.
 * Its lines go, the track only they ran, the stations only they served (but one a plan builds on, which
 * stays without them) and the changes to those; a plan building one of its lines goes with it.
 *
 * @param network - The network, as stored.
 * @param shown - The optional networks to keep.
 * @returns The network shown; the one given where nothing is left off.
 */
export const withNetworksShown = (network: Network, shown: readonly string[]): Network => {
  const hidden = new Set(optionalIdsOf(network).filter(id => !shown.includes(id)));
  if (hidden.size === 0) return network;
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
  const planned = new Set(Object.values(plans).flatMap(plan => plan.sections.flatMap(section => section.stations)));
  const stations = Object.fromEntries(
    Object.entries(network.stations)
      .filter(([id]) => served.has(id) || planned.has(id) || !servedBefore.has(id))
      .map(([id, station]) => [id, stationWithLines(station, kept)]),
  );
  return {
    ...network,
    networks: Object.fromEntries(Object.entries(network.networks).filter(([id]) => !hidden.has(id))),
    lines,
    stations,
    segments,
    ...(network.transfers ? { transfers: network.transfers.filter(({ stationA, stationB }) => stationA in stations && stationB in stations) } : {}),
    ...(network.plans ? { plans } : {}),
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
