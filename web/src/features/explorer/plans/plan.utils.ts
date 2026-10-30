import type { LngLat, Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { PlanFacts } from '~/features/explorer/plans/plan.types';

/** The Earth's mean radius, km. */
const EARTH_KM = 6371;

/**
 * The length of a polyline over the Earth.
 *
 * @param coordinates - Its points.
 * @returns Its length, km.
 */
const lengthKm = (coordinates: LngLat[]): number => {
  const radians = Math.PI / 180;
  let total = 0;
  for (let position = 1; position < coordinates.length; position++) {
    // Both points exist: the loop starts at the second.
    const [lng1, lat1] = coordinates[position - 1]!;
    const [lng2, lat2] = coordinates[position]!;
    const across =
      Math.sin(((lat2 - lat1) * radians) / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(((lng2 - lng1) * radians) / 2) ** 2;
    total += 2 * EARTH_KM * Math.asin(Math.sqrt(across));
  }
  return total;
};

/**
 * The length of a network's track.
 *
 * @param network - A network.
 * @returns Every segment's length, summed, km.
 */
const trackKm = (network: Network): number => network.segments.reduce((total, segment) => total + lengthKm(segment.coordinates), 0);

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
      return line ? [{ id, name: line.name, color: line.color, darkColor: line.darkColor ?? line.color }] : [];
    }),
  };
};
