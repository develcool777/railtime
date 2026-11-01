import type { Network } from '@railtime/schema/network.types';
import { cumulativeDistances } from '@railtime/core/geometry.utils';
import type { NetworkSummary, PlanFacts, ReachedSegment } from './facts.types';
import { toTimestamp, yearOf } from '@railtime/core/date.utils';
import { buildPlan, firstPlanOf, isPlanOnly } from '@railtime/schema/plan.utils';
import { REACH_BANDS } from './facts.constants';

/**
 * The length of a network's track.
 *
 * @param network - A network.
 * @returns Every segment's length, summed, km.
 */
const trackKm = (network: Network): number => network.segments.reduce((total, segment) => total + (cumulativeDistances(segment.coordinates).at(-1) ?? 0), 0);

/**
 * What a plan would add to its network, for its card.
 *
 * @param network - The city's network.
 * @param planId - One of its plans.
 * @returns Its new stations and track, and the lines it builds on.
 */
export const planFacts = (network: Network, planId: string): PlanFacts => {
  const built = buildPlan(network, planId);
  const lineIds = [...new Set(built.sections.map(section => section.line))];
  return {
    stations: Object.keys(network.plans?.[planId]?.stations ?? {}).length,
    // Splitting track for a new station keeps its length: what grows is the new track.
    km: Math.max(0, trackKm(built.network) - trackKm(network)),
    lines: lineIds.flatMap(id => {
      const line = built.network.lines[id];
      return line ? [{ id, name: line.name, color: { light: line.color, dark: line.darkColor ?? line.color } }] : [];
    }),
  };
};

/**
 * A network summed up, for a list of cities: its brands, when it began, how many plans, lines and
 * stations. A network never built is summed up by its first plan.
 *
 * @param network - The network.
 * @returns Its summary.
 */
export const networkSummary = (network: Network): NetworkSummary => {
  const planOnly = isPlanOnly(network);
  const shown = planOnly ? buildPlan(network, firstPlanOf(network) ?? '').network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? yearOf(toTimestamp(opened)) : null,
    planOnly,
    plans: Object.keys(network.plans ?? {}).length,
    lines: Object.values(shown.lines).filter(line => !line.pseudo).length,
    stations: Object.keys(shown.stations).length,
  };
};

/**
 * The band a time falls in: the last has no end, so every time finds one.
 *
 * @param minutes - How long it takes.
 * @returns The band's place in `REACH_BANDS`.
 */
export const bandOf = (minutes: number): number => REACH_BANDS.findIndex(entry => entry.upTo === null || minutes <= entry.upTo);

/**
 * The track a reach colours: each segment with a reached station at an end, timed as the mean of its
 * ends' times, or the one end's when only one is reached (a station its lines pass by).
 *
 * @param minutes - Minutes to each station reached, by id, the start's included.
 * @param segments - The segments open on the date, each once.
 * @param segments.index - The segment's id.
 * @param segments.stationA - One end.
 * @param segments.stationB - The other end.
 * @returns The segments reached, with their times.
 */
export const reachedSegments = (
  minutes: ReadonlyMap<string, number>,
  segments: Iterable<{ index: number; stationA: string; stationB: string }>,
): ReachedSegment[] => {
  const reached: ReachedSegment[] = [];
  for (const segment of segments) {
    const ends = [minutes.get(segment.stationA), minutes.get(segment.stationB)].filter((time): time is number => time !== undefined);
    if (ends.length > 0) reached.push({ segment: segment.index, minutes: ends.reduce((total, time) => total + time, 0) / ends.length });
  }
  return reached;
};
