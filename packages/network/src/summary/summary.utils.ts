import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { buildPlan, isPlanOnly } from '@railtime/schema/plan.utils';

/**
 * A network summed up, for a list of cities: its brands, when it began, how many plans, lines and
 * stations. A network never built is summed up by its first plan.
 *
 * @param network - The network.
 * @returns Its summary.
 */
export const networkSummary = (network: Network): Omit<CityIndexEntry, 'name' | 'country'> => {
  const planOnly = isPlanOnly(network);
  const shown = planOnly ? buildPlan(network, Object.keys(network.plans ?? {})[0] ?? '').network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? Number(opened.slice(0, 4)) : null,
    planOnly,
    plans: Object.keys(network.plans ?? {}).length,
    lines: Object.values(shown.lines).filter(line => !line.pseudo).length,
    stations: Object.keys(shown.stations).length,
  };
};
