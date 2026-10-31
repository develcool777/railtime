import { metresBetween } from '../core/geometry.utils.ts';
import type { Network, Plan, Segment, SegmentLine, Station } from '../format/network.types';
import { buildPlan } from '../plan/build.utils.ts';
import { STATION_GAP_METRES } from './checks.constants.ts';

/**
 * A line's dates on each of its segments at a station.
 *
 * @param network - The network.
 * @param station - The station id.
 * @param line - The line id.
 * @returns The dates; none if the line never runs there.
 */
const linePeriodsAt = (network: Network, station: string, line: string): SegmentLine[] =>
  network.segments.flatMap(segment => {
    const dates = segment.lines[line];
    return dates && (segment.stationA === station || segment.stationB === station) ? [dates] : [];
  });

/**
 * What is wrong with a station opening on a line later than the line came, if anything.
 * Dated after the line has left, it says the line never called there: that is sound.
 *
 * @param periods - The line's dates at the station.
 * @param date - The station's opening on it.
 * @returns The problem, or `null`.
 */
const infillProblem = (periods: SegmentLine[], date: string): string | null => {
  if (periods.length === 0) return "which doesn't run there";
  return periods.some(dates => dates.open <= date) ? null : 'before the line runs there';
};

/**
 * Checks each station's openings and closings on lines that already ran through it: on a line that
 * is there then, or the date does nothing.
 *
 * @param network - The network.
 * @param stationId - The station id.
 * @param station - The station.
 * @param problem - Reports one problem.
 */
const checkStationLines = (network: Network, stationId: string, station: Station, problem: (message: string) => void): void => {
  for (const [lineId, date] of Object.entries(station.infill ?? {})) {
    const wrong = infillProblem(linePeriodsAt(network, stationId, lineId), date);
    if (wrong) problem(`station ${stationId}: opens on ${lineId} on ${date}, ${wrong}`);
  }
  for (const [lineId, date] of Object.entries(station.closed ?? {})) {
    const running = linePeriodsAt(network, stationId, lineId).some(dates => dates.open < date && !(dates.close && dates.close <= date));
    if (network.lines[lineId] && !running) problem(`station ${stationId}: closes on ${lineId} on ${date}, when it doesn't run there`);
  }
};

/**
 * Checks the stations' references and dates, and the transfers between them.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkStations = (network: Network, problem: (message: string) => void): void => {
  for (const [stationId, station] of Object.entries(network.stations)) {
    for (const [lineId, date] of Object.entries(station.closed ?? {})) {
      if (!network.lines[lineId]) problem(`station ${stationId}: closed on unknown line ${lineId}`);
      const opened = station.infill?.[lineId];
      if (opened && date <= opened) problem(`station ${stationId}: closes on ${lineId} before it opens`);
    }
    checkStationLines(network, stationId, station, problem);
    const until = (station.formerNames ?? []).map(former => former.until);
    if (until.some((date, position) => position > 0 && date <= until[position - 1]!)) problem(`station ${stationId}: former names out of order`);
  }
  for (const { stationA, stationB } of network.transfers ?? []) {
    for (const station of [stationA, stationB]) if (!network.stations[station]) problem(`transfer ${stationA} – ${stationB}: unknown station ${station}`);
    if (stationA === stationB) problem(`transfer ${stationA}: to itself`);
  }
};

/**
 * Checks a segment: its stations and lines exist, its track reaches its stations, its dates are in order.
 *
 * @param network - The network, its shape already valid.
 * @param segment - One of its segments.
 * @param problem - Reports one problem.
 */
const checkSegment = (network: Network, segment: Segment, problem: (message: string) => void): void => {
  // Named by its stations, not its place in the list: a plan's split moves the places on.
  const name = `segment ${segment.stationA} – ${segment.stationB}`;
  for (const station of [segment.stationA, segment.stationB]) if (!network.stations[station]) problem(`${name}: unknown station ${station}`);
  // Its track starts at station A and ends at station B, or the line misses their dots.
  const ends = [
    [segment.stationA, segment.coordinates[0]],
    [segment.stationB, segment.coordinates.at(-1)],
  ] as const;
  for (const [station, end] of ends) {
    const place = network.stations[station]?.coordinate;
    const gap = place && end ? metresBetween(place, end) : 0;
    if (gap > STATION_GAP_METRES) problem(`${name}: its track ends ${Math.round(gap)} m from ${station}`);
  }
  for (const [lineId, dates] of Object.entries(segment.lines)) {
    if (!network.lines[lineId]) problem(`${name}: unknown line ${lineId}`);
    if (dates.close && dates.close <= dates.open) problem(`${name}: ${lineId} closes before it opens`);
    // Open, then each spell's start and end, then close: each after the one before.
    const changes = [dates.open, ...(dates.suspended ?? []).flatMap(spell => [spell.from, spell.until]), ...(dates.close ? [dates.close] : [])];
    if (changes.some((date, order) => order > 0 && date <= changes[order - 1]!)) problem(`${name}: ${lineId} suspended out of order`);
  }
};

/**
 * Checks the references between a network's parts, and its dates.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
export const checkNetwork = (network: Network, problem: (message: string) => void): void => {
  for (const [lineId, line] of Object.entries(network.lines)) {
    if (!network.networks[line.network]) problem(`line ${lineId}: unknown network ${line.network}`);
    for (const alias of line.aliases ?? []) if (!network.lines[alias.as]) problem(`line ${lineId}: alias to unknown line ${alias.as}`);
  }
  checkStations(network, problem);
  for (const segment of network.segments) checkSegment(network, segment, problem);
};

/**
 * A plan's ids that are already the network's, and its sections' lines and stations that are no one's.
 *
 * @param network - The network.
 * @param plan - One of its plans.
 * @returns A problem for each.
 */
const planReferenceProblems = (network: Network, plan: Plan): string[] => [
  ...Object.keys(plan.lines ?? {})
    .filter(line => network.lines[line])
    .map(line => `line ${line} is already in the network`),
  ...Object.keys(plan.stations ?? {})
    .filter(station => network.stations[station])
    .map(station => `station ${station} is already in the network`),
  ...plan.sections.flatMap((section, position) => [
    ...(network.lines[section.line] || plan.lines?.[section.line] ? [] : [`section ${position}: unknown line ${section.line}`]),
    ...section.stations
      .filter(station => !network.stations[station] && !plan.stations?.[station])
      .map(station => `section ${position}: unknown station ${station}`),
  ]),
];

/**
 * Checks each plan as the network it would build: its own ids new, its references and dates sound.
 * A problem the network already has is reported once, not again for every plan.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
export const checkPlans = (network: Network, problem: (message: string) => void): void => {
  const known = new Set<string>();
  checkNetwork(network, message => known.add(message));
  for (const [planId, plan] of Object.entries(network.plans ?? {})) {
    const references = planReferenceProblems(network, plan);
    for (const message of references) problem(`plan ${planId}: ${message}`);
    // Built only once its ids are sound: building needs every station's place.
    if (references.length > 0) continue;
    checkNetwork(buildPlan(network, planId).network, message => {
      if (!known.has(message)) problem(`plan ${planId}: ${message}`);
    });
  }
};
