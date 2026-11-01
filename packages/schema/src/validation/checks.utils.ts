import type { LngLat } from '@railtime/core/geometry.types';
import { cumulativeDistances, distanceKm, sliceAlong, turnDegrees } from '@railtime/core/geometry.utils';
import type { Mode, Network, Plan, Segment, SegmentLine, Station } from '../format/network.types';
import { buildPlan } from '../plan/build.utils.ts';
import { CURVE_SPAN_METRES, MAX_TURN_DEGREES, MIN_CURVE_RADIUS_METRES, STATION_GAP_METRES } from './checks.constants.ts';

/**
 * The sharpest a line of a mode may turn over `CURVE_SPAN_METRES` either side of a point: as much as
 * its trains' tightest curve turns over that, and never so much it doubles back.
 *
 * @param mode - The line's mode.
 * @returns The turn, degrees.
 */
const maxTurnOf = (mode: Mode): number => Math.min(MAX_TURN_DEGREES, ((2 * CURVE_SPAN_METRES) / MIN_CURVE_RADIUS_METRES[mode]) * (180 / Math.PI));

/**
 * The point a distance along a track.
 *
 * @param track - The track.
 * @param distances - Its `cumulativeDistances`.
 * @param atKm - How far along.
 * @returns The point.
 */
const pointAt = (track: LngLat[], distances: number[], atKm: number): LngLat => sliceAlong(track, distances, atKm).at(-1) ?? track[0]!;

/**
 * The sharpest turn along a track, each point's measured from `CURVE_SPAN_METRES` before it to as far
 * after (less near the track's ends): the curve a train takes there.
 *
 * @param track - The track.
 * @returns The turn, degrees, and the point it is at; `null` for a track with no point between its ends.
 */
const sharpestTurn = (track: LngLat[]): { degrees: number; position: number } | null => {
  const distances = cumulativeDistances(track);
  const lengthKm = distances.at(-1) ?? 0;
  let sharpest: { degrees: number; position: number } | null = null;
  for (const [position, corner] of track.entries()) {
    const atKm = distances[position] ?? 0;
    const spanKm = Math.min(CURVE_SPAN_METRES / 1000, atKm, lengthKm - atKm);
    if (spanKm <= 0) continue;
    const degrees = turnDegrees(pointAt(track, distances, atKm - spanKm), corner, pointAt(track, distances, atKm + spanKm));
    if (!sharpest || degrees > sharpest.degrees) sharpest = { degrees, position };
  }
  return sharpest;
};

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
  for (const lineId of station.passes ?? []) {
    if (!network.lines[lineId]) problem(`station ${stationId}: passed by unknown line ${lineId}`);
    else if (linePeriodsAt(network, stationId, lineId).length === 0) problem(`station ${stationId}: passed by ${lineId}, which doesn't run there`);
    if (station.infill?.[lineId] || station.closed?.[lineId]) problem(`station ${stationId}: passed by ${lineId}, which it also dates calling there`);
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
    for (const lineId of station.reverses ?? []) if (!network.lines[lineId]) problem(`station ${stationId}: reverses unknown line ${lineId}`);
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
    const gap = place && end ? distanceKm(place, end) * 1000 : 0;
    if (gap > STATION_GAP_METRES) problem(`${name}: its track ends ${Math.round(gap)} m from ${station}`);
  }
  // No track turns sharper than its trains can: up close, in 3D, a corner or a spike shows the line missing its station.
  const modes = Object.keys(segment.lines).flatMap(lineId => network.lines[lineId]?.mode ?? []);
  const sharpest = sharpestTurn(segment.coordinates);
  const limit = Math.max(0, ...modes.map(maxTurnOf));
  if (modes.length > 0 && sharpest && sharpest.degrees > limit)
    problem(`${name}: its track turns ${Math.round(sharpest.degrees)}° at point ${sharpest.position}, sharper than its trains can`);
  for (const [lineId, dates] of Object.entries(segment.lines)) {
    if (!network.lines[lineId]) problem(`${name}: unknown line ${lineId}`);
    if (dates.close && dates.close <= dates.open) problem(`${name}: ${lineId} closes before it opens`);
    // Open, then each spell's start and end, then close: each after the one before.
    const changes = [dates.open, ...(dates.suspended ?? []).flatMap(spell => [spell.from, spell.until]), ...(dates.close ? [dates.close] : [])];
    if (changes.some((date, order) => order > 0 && date <= changes[order - 1]!)) problem(`${name}: ${lineId} suspended out of order`);
  }
};

/** A line's track leaving a station: one of its segments, from the station's end. */
type TrackOut = { segment: Segment; dates: SegmentLine; track: LngLat[] };

/**
 * Whether two of a line's spells on segments overlap: only then do its trains run from one to the other.
 *
 * @param first - One spell.
 * @param second - The other.
 * @returns Whether they share a day.
 */
const overlap = (first: SegmentLine, second: SegmentLine): boolean =>
  (!second.close || first.open < second.close) && (!first.close || second.open < first.close);

/**
 * How sharply a line turns through a station, from one segment's track into another's, over
 * `CURVE_SPAN_METRES` of each (less on a shorter one).
 *
 * @param into - The track it leaves the station on, backwards.
 * @param out - The track it leaves on.
 * @returns The turn, degrees.
 */
const turnThrough = (into: LngLat[], out: LngLat[]): number => {
  const [intoKm, outKm] = [cumulativeDistances(into), cumulativeDistances(out)];
  const spanKm = Math.min(CURVE_SPAN_METRES / 1000, intoKm.at(-1) ?? 0, outKm.at(-1) ?? 0);
  return turnDegrees(pointAt(into, intoKm, spanKm), out[0]!, pointAt(out, outKm, spanKm));
};

/**
 * Checks each line runs through its stations as a train can: every track it leaves a station on
 * carries on smoothly from another it runs on then, unless it ends there or reverses there.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkThroughStations = (network: Network, problem: (message: string) => void): void => {
  const leaving = new Map<string, TrackOut[]>();
  for (const segment of network.segments) {
    for (const [lineId, dates] of Object.entries(segment.lines)) {
      for (const [station, track] of [
        [segment.stationA, segment.coordinates],
        [segment.stationB, segment.coordinates.toReversed()],
      ] as const) {
        const key = `${station}|${lineId}`;
        leaving.set(key, [...(leaving.get(key) ?? []), { segment, dates, track }]);
      }
    }
  }
  for (const [key, tracks] of leaving) {
    const [station = '', lineId = ''] = key.split('|');
    const mode = network.lines[lineId]?.mode;
    if (!mode || network.stations[station]?.reverses?.includes(lineId)) continue;
    let sharpest = 0;
    for (const out of tracks) {
      const turns = tracks.filter(into => into !== out && overlap(into.dates, out.dates)).map(into => turnThrough(into.track, out.track));
      if (turns.length > 0) sharpest = Math.max(sharpest, Math.min(...turns));
    }
    if (sharpest > maxTurnOf(mode)) problem(`station ${station}: ${lineId} turns ${Math.round(sharpest)}° through it, sharper than its trains can`);
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
  checkThroughStations(network, problem);
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
