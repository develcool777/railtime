import { toTimestamp, yearOf } from '@railtime/core/date.utils';
import type { Network } from '@railtime/schema/network.types';
import { buildPlan, firstPlanOf, isPlanOnly } from '@railtime/schema/plan.utils';
import type { NetworkSummary } from '../facts/facts.types';

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
