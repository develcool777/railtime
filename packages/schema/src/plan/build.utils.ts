import type { Network } from '../format/network.types';
import type { BuiltPlan } from './build.types';
import { PlanBuilder } from './builder.service.ts';

/**
 * Builds one of a network's plans on it, section by section.
 *
 * @param network - The network; its plan's ids must resolve (the schema checks).
 * @param planId - One of its plans; an unknown one builds nothing.
 * @returns The network as the plan needs it, and what each section opens.
 */
export const buildPlan = (network: Network, planId: string): BuiltPlan => {
  const { plans, ...today } = network;
  const plan = plans?.[planId];
  if (!plan) return { network: today, sections: [] };
  const works = new PlanBuilder({
    ...today,
    lines: { ...today.lines, ...plan.lines },
    stations: { ...today.stations, ...plan.stations },
    segments: [...today.segments],
    ...(today.transfers || plan.transfers ? { transfers: [...(today.transfers ?? []), ...(plan.transfers ?? [])] } : {}),
  });
  for (const section of plan.sections) works.build(section);
  const position = new Map(works.network.segments.map((segment, index) => [segment, index]));
  return {
    network: works.network,
    // Within bounds: every section's segment is one of the network's.
    sections: works.sections.map(section => ({
      line: section.line,
      infills: section.infills,
      segments: section.segments.map(segment => position.get(segment)!),
    })),
  };
};

/**
 * Whether a network was never built: no track of its own, only plans.
 *
 * @param network - The network.
 * @returns True if it has plans and nothing else.
 */
export const isPlanOnly = (network: Network): boolean => network.segments.length === 0 && Object.keys(network.plans ?? {}).length > 0;

/**
 * The plan a network is shown by when none is asked for and it was never built: its first.
 *
 * @param network - The network.
 * @returns Its first plan's id, or none if it has no plans.
 */
export const firstPlanOf = (network: Network): string | undefined => Object.keys(network.plans ?? {})[0];
