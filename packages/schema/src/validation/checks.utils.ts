import type { LngLat } from '@railtime/core/geometry.types';
import { cumulativeDistances, distanceKm, sliceAlong, turnDegrees } from '@railtime/core/geometry.utils';
import { CURVE_SPAN_METRES, MAX_TURN_DEGREES, MIN_CURVE_RADIUS_METRES, STATION_GAP_METRES } from './checks.constants.ts';
import type { TrackOut } from './checks.types';
import type { Mode, Network, Segment, SegmentLine, Station, Suspension } from '../format/network.types';

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
 * What is wrong with a line's spells of not calling at a station: each while the line runs there and
 * calls, after the station opened on it and before it closed, ending after it starts, in order.
 *
 * @param network - The network.
 * @param stationId - The station id.
 * @param station - The station.
 * @param lineId - The line.
 * @param spells - Its spells, oldest first.
 * @returns Each problem, in words.
 */
const suspensionProblems = (network: Network, stationId: string, station: Station, lineId: string, spells: Suspension[]): string[] => {
  if (!network.lines[lineId]) return ['an unknown line'];
  const periods = linePeriodsAt(network, stationId, lineId);
  const opened = station.infill?.[lineId];
  const closed = station.closed?.[lineId];
  return spells.flatMap(({ from, until }, position) => {
    const spell = `${from} – ${until}`;
    const running = periods.some(dates => dates.open < from && !(dates.close && dates.close < until));
    return [
      ...(until <= from ? [`${spell}, ending before it starts`] : []),
      // Within bounds: only past the first spell, which has one before it.
      ...(position > 0 && from <= spells[position - 1]!.until ? [`${spell}, before the spell ahead of it ends`] : []),
      ...(running ? [] : [`${spell}, when it doesn't run there`]),
      ...((opened && from <= opened) || (closed && until >= closed) ? [`${spell}, outside when the station is open on it`] : []),
    ];
  });
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
  for (const [lineId, spells] of Object.entries(station.suspended ?? {}))
    for (const wrong of suspensionProblems(network, stationId, station, lineId, spells))
      problem(`station ${stationId}: closed for a while on ${lineId}, ${wrong}`);
  for (const lineId of station.passes ?? []) checkPass(network, stationId, station, lineId, problem);
};

/**
 * Checks a line a station says it runs through without calling: a known line that runs there, and
 * one the station dates no calls of.
 *
 * @param network - The network.
 * @param stationId - The station id.
 * @param station - The station.
 * @param lineId - The line passing it.
 * @param problem - Reports one problem.
 */
const checkPass = (network: Network, stationId: string, station: Station, lineId: string, problem: (message: string) => void): void => {
  if (!network.lines[lineId]) problem(`station ${stationId}: passed by unknown line ${lineId}`);
  else if (linePeriodsAt(network, stationId, lineId).length === 0) problem(`station ${stationId}: passed by ${lineId}, which doesn't run there`);
  if (station.infill?.[lineId] || station.closed?.[lineId] || station.suspended?.[lineId])
    problem(`station ${stationId}: passed by ${lineId}, which it also dates calling there`);
};

/**
 * Checks the stations' references and dates, and the transfers between them.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
const checkStations = (network: Network, problem: (message: string) => void): void => {
  for (const [stationId, station] of Object.entries(network.stations)) checkStation(network, stationId, station, problem);
  for (const { stationA, stationB } of network.transfers ?? []) {
    for (const station of [stationA, stationB]) if (!network.stations[station]) problem(`transfer ${stationA} – ${stationB}: unknown station ${station}`);
    if (stationA === stationB) problem(`transfer ${stationA}: to itself`);
  }
};

/**
 * Checks a station: its closings on known lines and after it opens there, its lines' dates, the
 * lines it reverses, and its former names in order.
 *
 * @param network - The network, its shape already valid.
 * @param stationId - The station id.
 * @param station - The station.
 * @param problem - Reports one problem.
 */
const checkStation = (network: Network, stationId: string, station: Station, problem: (message: string) => void): void => {
  for (const [lineId, date] of Object.entries(station.closed ?? {})) {
    if (!network.lines[lineId]) problem(`station ${stationId}: closed on unknown line ${lineId}`);
    const opened = station.infill?.[lineId];
    if (opened && date <= opened) problem(`station ${stationId}: closes on ${lineId} before it opens`);
  }
  checkStationLines(network, stationId, station, problem);
  for (const lineId of station.reverses ?? []) if (!network.lines[lineId]) problem(`station ${stationId}: reverses unknown line ${lineId}`);
  const until = (station.formerNames ?? []).map(former => former.until);
  if (until.some((date, position) => position > 0 && date <= until[position - 1]!)) problem(`station ${stationId}: former names out of order`);
};

/**
 * Where a line's timeline starts: its network's own, for one hidden at first that is older than the city, or the city's.
 *
 * @param network - The network.
 * @param lineId - One of its lines.
 * @returns The date.
 */
const startOf = (network: Network, lineId: string): string => {
  const info = network.networks[network.lines[lineId]?.network ?? ''];
  if (info?.hidden && info.start) return info.start;
  return network.meta.start;
};

/**
 * A segment's track turning sharper than the trains on it can: up close, in 3D, a corner or a spike
 * shows the line missing its station. The most agile of its lines' modes sets the limit.
 *
 * @param segment - The segment.
 * @param modes - The modes of the lines on it; none, and it is not checked.
 * @returns The problem, or `null`.
 */
export const segmentTurnProblem = (segment: Segment, modes: Mode[]): string | null => {
  const sharpest = sharpestTurn(segment.coordinates);
  if (modes.length === 0 || !sharpest || sharpest.degrees <= Math.max(...modes.map(maxTurnOf))) return null;
  return `segment ${segment.stationA} – ${segment.stationB}: its track turns ${Math.round(sharpest.degrees)}° at point ${sharpest.position}, sharper than its trains can`;
};

/**
 * Checks a segment: its stations and lines exist, its track reaches its stations, its dates are in order, none before its timeline starts.
 *
 * @param network - The network, its shape already valid.
 * @param segment - One of its segments.
 * @param problem - Reports one problem.
 */
const checkSegment = (network: Network, segment: Segment, problem: (message: string) => void): void => {
  // Named by its stations, not its place in the list: a plan's split moves the places on.
  const name = `segment ${segment.stationA} – ${segment.stationB}`;
  for (const station of [segment.stationA, segment.stationB]) if (!network.stations[station]) problem(`${name}: unknown station ${station}`);
  checkSegmentEnds(network, segment, name, problem);
  const turn = segmentTurnProblem(
    segment,
    Object.keys(segment.lines).flatMap(lineId => network.lines[lineId]?.mode ?? []),
  );
  if (turn) problem(turn);
  for (const [lineId, dates] of Object.entries(segment.lines)) checkSegmentLine(network, name, lineId, dates, problem);
};

/**
 * Checks a segment's track starts at station A and ends at station B, or the line misses their dots.
 *
 * @param network - The network, its shape already valid.
 * @param segment - The segment.
 * @param name - The segment, as problems name it.
 * @param problem - Reports one problem.
 */
const checkSegmentEnds = (network: Network, segment: Segment, name: string, problem: (message: string) => void): void => {
  const ends = [
    [segment.stationA, segment.coordinates[0]],
    [segment.stationB, segment.coordinates.at(-1)],
  ] as const;
  for (const [station, end] of ends) {
    const place = network.stations[station]?.coordinate;
    const gap = place && end ? distanceKm(place, end) * 1000 : 0;
    if (gap > STATION_GAP_METRES) problem(`${name}: its track ends ${Math.round(gap)} m from ${station}`);
  }
};

/**
 * Checks a line's dates on a segment: a known line, opening once its timeline starts, closing after
 * it opens, its spells in order between.
 *
 * @param network - The network, its shape already valid.
 * @param name - The segment, as problems name it.
 * @param lineId - The line.
 * @param dates - Its dates on the segment.
 * @param problem - Reports one problem.
 */
const checkSegmentLine = (network: Network, name: string, lineId: string, dates: SegmentLine, problem: (message: string) => void): void => {
  if (!network.lines[lineId]) problem(`${name}: unknown line ${lineId}`);
  // Before its timeline starts, a line's opening would never play.
  const start = startOf(network, lineId);
  if (dates.open < start) problem(`${name}: ${lineId} opens before its timeline starts, ${start}`);
  if (dates.close && dates.close <= dates.open) problem(`${name}: ${lineId} closes before it opens`);
  // Open, then each spell's start and end, then close: each after the one before.
  const changes = [dates.open, ...(dates.suspended ?? []).flatMap(spell => [spell.from, spell.until]), ...(dates.close ? [dates.close] : [])];
  if (changes.some((date, order) => order > 0 && date <= changes[order - 1]!)) problem(`${name}: ${lineId} suspended out of order`);
};

/**
 * Whether a line's trains run from one of its tracks to another: only while both are open, a plan's
 * whenever the other is.
 *
 * @param first - One track's dates.
 * @param second - The other's.
 * @returns Whether they share a day.
 */
const overlap = (first: SegmentLine | null, second: SegmentLine | null): boolean =>
  !first || !second || ((!second.close || first.open < second.close) && (!first.close || second.open < first.close));

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
 * Each line's dated track leaving each station, keyed `station|line`.
 *
 * @param network - The network.
 * @returns The tracks, a list for each station and line.
 */
export const datedTracksOut = (network: Network): Map<string, TrackOut[]> => {
  const leaving = new Map<string, TrackOut[]>();
  for (const segment of network.segments)
    for (const [lineId, dates] of Object.entries(segment.lines)) for (const out of tracksOut(segment, dates)) pushTrack(leaving, out.station, lineId, out);
  return leaving;
};

/**
 * A segment's track leaving each of its stations.
 *
 * @param segment - The segment.
 * @param dates - When the line on it runs there, or `null` for a plan's.
 * @returns Its two ends' tracks, each with its station.
 */
export const tracksOut = (segment: Segment, dates: SegmentLine | null): (TrackOut & { station: string })[] => [
  { station: segment.stationA, track: segment.coordinates, dates },
  { station: segment.stationB, track: segment.coordinates.toReversed(), dates },
];

/**
 * Adds a line's track leaving a station to those keyed `station|line`.
 *
 * @param leaving - The tracks so far.
 * @param station - The station.
 * @param lineId - The line.
 * @param out - The track.
 */
export const pushTrack = (leaving: Map<string, TrackOut[]>, station: string, lineId: string, out: TrackOut): void => {
  const key = `${station}|${lineId}`;
  leaving.set(key, [...(leaving.get(key) ?? []), out]);
};

/**
 * Lines turning sharper through a station than their trains can: every track one leaves a station on
 * carries on smoothly from another it runs on then, unless it ends there or reverses there.
 *
 * @param network - The network the tracks are its.
 * @param leaving - Each line's tracks leaving each station (`datedTracksOut`, a plan's added).
 * @param checks - Which tracks leaving are checked; every one, unless said.
 * @returns A problem for each station and line.
 */
export const throughStationProblems = (network: Network, leaving: Map<string, TrackOut[]>, checks: (out: TrackOut) => boolean = () => true): string[] => {
  const problems: string[] = [];
  for (const [key, tracks] of leaving) {
    const [station = '', lineId = ''] = key.split('|', 2);
    const mode = network.lines[lineId]?.mode;
    if (!mode || network.stations[station]?.reverses?.includes(lineId)) continue;
    let sharpest = 0;
    for (const out of tracks) {
      if (!checks(out)) continue;
      const turns = tracks.filter(into => into !== out && overlap(into.dates, out.dates)).map(into => turnThrough(into.track, out.track));
      if (turns.length > 0) sharpest = Math.max(sharpest, Math.min(...turns));
    }
    if (sharpest > maxTurnOf(mode)) problems.push(`station ${station}: ${lineId} turns ${Math.round(sharpest)}° through it, sharper than its trains can`);
  }
  return problems;
};

/**
 * Checks the references between a network's parts, and its dates.
 *
 * @param network - The network, its shape already valid.
 * @param problem - Reports one problem.
 */
export const checkNetwork = (network: Network, problem: (message: string) => void): void => {
  for (const [networkId, info] of Object.entries(network.networks)) {
    // Only a network hidden at first may start apart, and only before the city: the city's own history starts with it.
    if (info.start && (!info.hidden || info.start >= network.meta.start))
      problem(`network ${networkId}: a start of its own, ${info.start}, but it is not a network hidden at first, older than the city`);
  }
  for (const [lineId, line] of Object.entries(network.lines)) {
    if (!network.networks[line.network]) problem(`line ${lineId}: unknown network ${line.network}`);
    for (const alias of line.aliases ?? []) if (!network.lines[alias.as]) problem(`line ${lineId}: alias to unknown line ${alias.as}`);
  }
  checkStations(network, problem);
  for (const segment of network.segments) checkSegment(network, segment, problem);
  for (const message of throughStationProblems(network, datedTracksOut(network))) problem(message);
};
