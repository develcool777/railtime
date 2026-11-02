import type { Network, Plan } from '../format/network.types';
import type { BuiltPlan } from '../plan/build.types';
import { buildPlan } from '../plan/build.utils.ts';
import { checkNetwork, datedTracksOut, pushTrack, segmentTurnProblem, throughStationProblems, tracksOut } from './checks.utils.ts';
import type { TrackOut } from './checks.types';

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
 * A plan's track that would never be laid: between a station no one has, two stations no section
 * links, or two the network links already; or given twice. Where it is laid, the network built is
 * checked as any other: its ends on its stations, no turn sharper than its trains can.
 *
 * @param network - The network.
 * @param plan - One of its plans.
 * @returns A problem for each.
 */
const planTrackProblems = (network: Network, plan: Plan): string[] => {
  const pairOf = (stationA: string, stationB: string) => [stationA, stationB].sort().join(' – ');
  const linked = new Set(plan.sections.flatMap(section => section.stations.slice(1).map((station, position) => pairOf(section.stations[position]!, station))));
  const built = new Set(network.segments.map(segment => pairOf(segment.stationA, segment.stationB)));
  const seen = new Set<string>();
  return (plan.track ?? []).flatMap(({ stationA, stationB }) => {
    const pair = pairOf(stationA, stationB);
    const unknown = [stationA, stationB].filter(station => !network.stations[station] && !plan.stations?.[station]);
    const problems = [
      ...unknown.map(station => `track ${pair}: unknown station ${station}`),
      ...(linked.has(pair) ? [] : [`track ${pair}: between stations no section links`]),
      ...(built.has(pair) ? [`track ${pair}: between stations the network links already`] : []),
      ...(seen.has(pair) ? [`track ${pair}: given twice`] : []),
    ];
    seen.add(pair);
    return problems;
  });
};

/**
 * A plan's sections of a line coming back after another line's: a plan plays in its order, so each
 * line's sections go together, the line built whole before the next.
 *
 * @param plan - One of the network's plans.
 * @returns A problem for each.
 */
const planOrderProblems = (plan: Plan): string[] =>
  plan.sections.flatMap((section, position) => {
    const before = plan.sections[position - 1];
    const earlier = plan.sections.slice(0, position - 1).some(other => other.line === section.line);
    return before && before.line !== section.line && earlier
      ? [`section ${position}: ${section.line} again, after ${before.line}: a line's sections go together`]
      : [];
  });

/**
 * A plan's sections adding only stations on its line's track between two that lay more of it: a line's
 * track plays unbroken, the stations it adds on it before or after, so no station breaks an extension.
 *
 * @param built - A plan built on the network.
 * @returns A problem for each.
 */
const planStationOrderProblems = (built: BuiltPlan): string[] =>
  built.sections.flatMap((section, position) => {
    const laysTrack = (other: BuiltPlan['sections'][number]) => other.line === section.line && other.segments.length > 0;
    const between = built.sections.slice(0, position).some(laysTrack) && built.sections.slice(position + 1).some(laysTrack);
    return section.segments.length === 0 && between
      ? [`section ${position}: only stations, between sections of ${section.line}'s track: its track goes unbroken`]
      : [];
  });

/**
 * A plan's lines turning sharper than their trains can, on the track its sections put them on, which
 * has no dates to say its lines: inside a segment, and through a station from one of a line's segments
 * into another, its own or the network's, unless the line ends there or reverses there. Held as the
 * network's are (`segmentTurnProblem`, `throughStationProblems`).
 *
 * @param built - A plan built on the network.
 * @returns A problem for each.
 */
const planCurveProblems = (built: BuiltPlan): string[] => {
  const { network } = built;
  const problems = new Set<string>();
  const leaving = datedTracksOut(network);
  const planned = new Set<TrackOut>();
  for (const section of built.sections) {
    const mode = network.lines[section.line]?.mode;
    if (!mode) continue;
    for (const position of section.segments) {
      // Within bounds: a built section's segments are the network's.
      const segment = network.segments[position]!;
      const turn = segmentTurnProblem(segment, [mode]);
      if (turn) problems.add(turn);
      for (const { station, ...out } of tracksOut(segment, null)) {
        pushTrack(leaving, station, section.line, out);
        planned.add(out);
      }
    }
  }
  // Only where a plan's track leaves: the network's own turns are its own problems.
  for (const message of throughStationProblems(network, leaving, out => planned.has(out))) problems.add(message);
  return [...problems];
};

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
    const references = [...planReferenceProblems(network, plan), ...planTrackProblems(network, plan)];
    for (const message of [...references, ...planOrderProblems(plan)]) problem(`plan ${planId}: ${message}`);
    // Built only once its ids are sound: building needs every station's place.
    if (references.length > 0) continue;
    const built = buildPlan(network, planId);
    for (const message of [...planStationOrderProblems(built), ...planCurveProblems(built)]) problem(`plan ${planId}: ${message}`);
    checkNetwork(built.network, message => {
      if (!known.has(message)) problem(`plan ${planId}: ${message}`);
    });
  }
};
