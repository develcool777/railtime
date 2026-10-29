import type { Network } from './network.types';

/**
 * The network with one of its plans built: the plan's lines, stations, track and transfers added.
 *
 * @param network - The network.
 * @param planId - One of its plans; an unknown one adds nothing.
 * @returns The network as the plan would leave it, without its plans.
 */
export const applyPlan = (network: Network, planId: string): Network => {
  const { plans, ...today } = network;
  const plan = plans?.[planId];
  if (!plan) return today;
  return {
    ...today,
    lines: { ...today.lines, ...plan.lines },
    stations: { ...today.stations, ...plan.stations },
    segments: [...today.segments, ...(plan.segments ?? [])],
    ...(today.transfers || plan.transfers ? { transfers: [...(today.transfers ?? []), ...(plan.transfers ?? [])] } : {}),
  };
};
