import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import { cumulativeDistances } from '../core/geometry.utils';
import type { PlanFacts } from '../facts/facts.types';

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
