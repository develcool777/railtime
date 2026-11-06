import { cumulativeDistances } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import type { BuiltPlan } from './build.types';
import { PlanBuilder } from './builder.service.ts';
import type { Network, PlanId } from '../format/network.types';

/**
 * Builds one of a network's plans on it, section by section.
 *
 * @param network - The network; its plan's ids must resolve (the schema checks).
 * @param planId - One of its plans; an unknown one builds nothing.
 * @returns The network as the plan needs it, and what each section opens.
 */
export const buildPlan = (network: Network, planId: PlanId): BuiltPlan => {
  const { plans, ...today } = network;
  const plan = plans?.[planId];
  if (!plan) return { network: today, sections: [], laidKm: 0 };
  const works = new PlanBuilder(
    {
      ...today,
      lines: { ...today.lines, ...plan.lines },
      stations: { ...today.stations, ...plan.stations },
      segments: [...today.segments],
      ...((today.transfers ?? plan.transfers) && { transfers: [...(today.transfers ?? []), ...(plan.transfers ?? [])] }),
    },
    plan.track,
  );
  for (const section of plan.sections) works.build(section);
  works.curve();
  const position = new Map(works.network.segments.map((segment, index) => [segment, index]));
  let laidKm = 0;
  for (const { coordinates } of works.laid) laidKm += cumulativeDistances(coordinates).at(-1) ?? 0;
  return {
    network: works.network,
    laidKm,
    sections: works.sections.map(section => ({
      line: section.line,
      infills: section.infills,
      segments: section.segments.map(segment => required(position.get(segment), "a section's segment among the network's")),
    })),
  };
};
