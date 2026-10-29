import type { Network, Plan, Segment, Station } from '@railtime/schema/network.types';

/**
 * A station with its fields in reading order.
 *
 * @param station - The station.
 * @returns The same station, name first.
 */
const orderStation = (station: Station): Station => ({
  name: station.name,
  ...(station.names ? { names: station.names } : {}),
  coordinate: station.coordinate,
  ...(station.infill ? { infill: station.infill } : {}),
  ...(station.closed ? { closed: station.closed } : {}),
  ...(station.formerNames ? { formerNames: station.formerNames } : {}),
});

/**
 * A segment with its fields in reading order: its stations and dates first, its long coordinates last.
 *
 * @param segment - The segment.
 * @returns The same segment, reordered.
 */
const orderSegment = (segment: Segment): Segment => ({
  stationA: segment.stationA,
  stationB: segment.stationB,
  lines: segment.lines,
  coordinates: segment.coordinates,
});

/** A JSON value already written out, to nest as it is. */
type Written = { text: string };

/**
 * An object as JSON, one field per line, each value as JSON on that line or already written out.
 *
 * @param fields - Its fields, in the order to write them.
 * @param indent - The object's own indentation.
 * @returns The object's JSON.
 */
const objectLines = (fields: [string, unknown][], indent: string): string => {
  const body = fields.map(([key, value]) => {
    const text = typeof value === 'object' && value !== null && 'text' in value ? (value as Written).text : JSON.stringify(value);
    return `${indent}  ${JSON.stringify(key)}: ${text}`;
  });
  return `{\n${body.join(',\n')}\n${indent}}`;
};

/**
 * An array as JSON, one item per line, so a change to one item is a one-line diff.
 *
 * @param items - Its items, in order.
 * @param indent - The array's own indentation.
 * @returns The array, written out.
 */
const arrayLines = (items: unknown[], indent: string): Written => {
  const body = items.map(item => `${indent}  ${JSON.stringify(item)}`).join(',\n');
  return { text: `[\n${body}\n${indent}]` };
};

/**
 * A record as JSON, one entry per line.
 *
 * @param entries - Its entries, in the order to write them.
 * @param indent - The record's own indentation.
 * @returns The record, written out.
 */
const recordLines = (entries: [string, unknown][], indent: string): Written => ({ text: objectLines(entries, indent) });

/**
 * A network's or plan's lines, stations, track and transfers: stations by id, segments and transfers by
 * their stations.
 *
 * @param parts - The parts it has.
 * @param indent - The indentation of the object they are in.
 * @returns Their fields, written out, without those it does not have.
 */
const partFields = (parts: Pick<Network, 'stations' | 'segments' | 'transfers'> & { lines?: Network['lines'] }, indent: string): [string, Written][] => {
  const level = `${indent}  `;
  const stations = Object.entries(parts.stations)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([id, station]): [string, unknown] => [id, orderStation(station)]);
  const segments = parts.segments
    .map(orderSegment)
    .sort((first, second) => first.stationA.localeCompare(second.stationA) || first.stationB.localeCompare(second.stationB));
  const transfers = (parts.transfers ?? [])
    .map(({ stationA, stationB }) => (stationB < stationA ? { stationA: stationB, stationB: stationA } : { stationA, stationB }))
    .sort((first, second) => first.stationA.localeCompare(second.stationA) || first.stationB.localeCompare(second.stationB));
  return [
    ...(parts.lines ? [['lines', recordLines(Object.entries(parts.lines), level)] as [string, Written]] : []),
    ...(stations.length > 0 ? [['stations', recordLines(stations, level)] as [string, Written]] : []),
    ...(segments.length > 0 ? [['segments', arrayLines(segments, level)] as [string, Written]] : []),
    ...(transfers.length > 0 ? [['transfers', arrayLines(transfers, level)] as [string, Written]] : []),
  ];
};

/**
 * A plan, its description first and its parts laid out as the network's.
 *
 * @param plan - The plan.
 * @param indent - The plan's own indentation.
 * @returns The plan, written out.
 */
const planLines = (plan: Plan, indent: string): Written => ({
  text: objectLines(
    [
      ['name', plan.name],
      ...(plan.names ? [['names', plan.names] as [string, unknown]] : []),
      ['description', plan.description],
      ...(plan.sources ? [['sources', plan.sources] as [string, unknown]] : []),
      ...(plan.lines && Object.keys(plan.lines).length > 0 ? [['lines', recordLines(Object.entries(plan.lines), `${indent}  `)] as [string, unknown]] : []),
      ...partFields({ stations: plan.stations ?? {}, segments: plan.segments ?? [], ...(plan.transfers ? { transfers: plan.transfers } : {}) }, indent),
    ],
    indent,
  ),
});

/**
 * A city's dataset as it is kept in `data/<city>/<city>.json`: one line, station or segment per line,
 * stations by id and segments by their stations, so the file reads and diffs well and the same
 * network is always written the same way. Each plan is laid out the same way, inside `plans`.
 *
 * @param network - The network.
 * @returns The file's text.
 */
export const formatNetwork = (network: Network): string => {
  const plans = Object.entries(network.plans ?? {}).map(([id, plan]): [string, Written] => [id, planLines(plan, '    ')]);
  const fields: [string, unknown][] = [
    ['meta', network.meta],
    ['networks', recordLines(Object.entries(network.networks), '  ')],
    ...partFields(network, ''),
    ...(plans.length > 0 ? [['plans', { text: objectLines(plans, '  ') }] as [string, unknown]] : []),
  ];
  return `${objectLines(fields, '')}\n`;
};
