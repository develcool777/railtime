import type { Network } from './network.types';
import type { BuiltPlan } from './plan.types';
import { PlanBuilder } from './planBuilder.service.ts';

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
