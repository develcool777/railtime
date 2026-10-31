import type { CityIndex, CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { buildPlan, isPlanOnly } from '@railtime/schema/plan.utils';
import { writeFileSync } from 'node:fs';
import { SUMMARIES_PATH, cities, readNetwork } from '../city.utils.ts';

/**
 * One city, summed up for the landing page: how many lines and stations, when it began, how many plans.
 * A network never built is summed up by its first plan. Its picture is drawn apart, by
 * `pnpm data:previews`.
 *
 * @param network - The city's network.
 * @param country - Its country's folder in `cities/`.
 * @returns The city's entry.
 */
export const summaryOf = (network: Network, country: string): CityIndexEntry => {
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
 * The summaries as `cities/cities.json` keeps them: one city per line, so it diffs city by city.
 *
 * @param summaries - Each city's summary, by id.
 * @returns The file's text.
 */
export const formatSummaries = (summaries: CityIndex): string =>
  `{\n${Object.entries(summaries)
    .map(([city, entry]) => `  ${JSON.stringify(city)}: ${JSON.stringify(entry)}`)
    .join(',\n')}\n}\n`;

/**
 * Sums up every city and writes `cities/cities.json`, the list the landing page shows.
 *
 * @throws {z.ZodError} If the schema refuses a city's network.
 */
export const writeSummaries = (): void => {
  const summaries = Object.fromEntries(cities().map(city => [city.id, summaryOf(readNetwork(city), city.country)]));
  writeFileSync(SUMMARIES_PATH, formatSummaries(summaries));
  console.log(`${SUMMARIES_PATH}: ${Object.keys(summaries).length} cities`);
};
