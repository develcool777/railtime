import type { Network, Segment, Station } from '@railtime/schema/network.types';

/**
 * A station with its fields in reading order.
 *
 * @param station - The station.
 * @returns The same station, name first.
 */
const orderStation = (station: Station): Station => ({
  name: station.name,
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

/**
 * A record as JSON with one entry per line, so a change to one station or segment is a one-line diff.
 *
 * @param entries - The record's entries, in the order to write them.
 * @returns The record's JSON, indented one level.
 */
const recordLines = (entries: [string, unknown][]): string => {
  const body = entries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(',\n');
  return `{\n${body}\n  }`;
};

/**
 * A city's dataset as it is kept in `data/<city>/<city>.json`: one line, station or segment per line,
 * stations by id and segments by their stations, so the file reads and diffs well and the same
 * network is always written the same way.
 *
 * @param network - The network.
 * @returns The file's text.
 */
export const formatNetwork = (network: Network): string => {
  const stations = Object.entries(network.stations)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([id, station]): [string, unknown] => [id, orderStation(station)]);
  const segments = network.segments
    .map(orderSegment)
    .sort((first, second) => first.stationA.localeCompare(second.stationA) || first.stationB.localeCompare(second.stationB));
  const segmentLines = segments.map(segment => `    ${JSON.stringify(segment)}`).join(',\n');
  return [
    '{',
    `  "meta": ${JSON.stringify(network.meta)},`,
    `  "networks": ${recordLines(Object.entries(network.networks))},`,
    `  "lines": ${recordLines(Object.entries(network.lines))},`,
    `  "stations": ${recordLines(stations)},`,
    `  "segments": [\n${segmentLines}\n  ]`,
    '}',
    '',
  ].join('\n');
};
