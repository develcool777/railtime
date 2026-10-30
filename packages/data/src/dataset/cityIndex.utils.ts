import type { CityIndex, CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { buildPlan, isPlanOnly } from '@railtime/schema/plan.utils';

/**
 * One city, summed up for the index: how many lines and stations, when it began, how many plans.
 * A network never built is summed up by its first plan. Its picture is drawn apart, by
 * `pnpm data:previews`.
 *
 * @param network - The city's network.
 * @param country - Its country's folder in `cities/`.
 * @returns The city's entry.
 */
export const indexEntryOf = (network: Network, country: string): CityIndexEntry => {
  const planOnly = isPlanOnly(network);
  const shown = planOnly ? buildPlan(network, Object.keys(network.plans ?? {})[0] ?? '').network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    name: network.meta.city,
    country,
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? Number(opened.slice(0, 4)) : null,
    planOnly,
    plans: Object.keys(network.plans ?? {}).length,
    lines: Object.values(shown.lines).filter(line => !line.pseudo).length,
    stations: Object.keys(shown.stations).length,
  };
};

/**
 * The index as it is kept in `cities/cities.json`: one city per line, so it diffs city by city.
 *
 * @param index - The index.
 * @returns The file's text.
 */
export const formatCityIndex = (index: CityIndex): string =>
  `{\n${Object.entries(index)
    .map(([city, entry]) => `  ${JSON.stringify(city)}: ${JSON.stringify(entry)}`)
    .join(',\n')}\n}\n`;
