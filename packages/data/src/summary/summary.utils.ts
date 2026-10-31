import type { CityIndex, CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { networkSummary } from '@railtime/network/summary.utils';
import { writeFileSync } from 'node:fs';
import { SUMMARIES_PATH, cities, readNetwork } from '../city.utils.ts';

/**
 * One city, summed up for the landing page: its name and country, and its network's summary
 * (`networkSummary`). Its picture is drawn apart, by `pnpm data:previews`.
 *
 * @param network - The city's network.
 * @param country - Its country's folder in `cities/`.
 * @returns The city's entry.
 */
export const summaryOf = (network: Network, country: string): CityIndexEntry => ({ name: network.meta.city, country, ...networkSummary(network) });

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
