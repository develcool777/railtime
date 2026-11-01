import type { CityIndex, CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { NetworkFacts } from '@railtime/network/facts.service';
import { required } from '@railtime/core/required.utils';
import { slugOf } from '@railtime/core/text.utils';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SUMMARIES_PATH, cities, readNetwork } from '../city.utils.ts';

/**
 * One city, summed up for the landing page: its name and country, and its network's summary
 * (`NetworkFacts.summary`). Its picture is drawn apart, by `pnpm data:previews`.
 *
 * @param network - The city's network.
 * @returns The city's entry.
 */
export const summaryOf = (network: Network): CityIndexEntry => ({
  name: network.meta.city,
  country: network.meta.country,
  ...NetworkFacts.create(network).summary(),
});

/**
 * The cities in the order the list had them, which is the site's (hand-ordered, in `cities.json`):
 * a city new to it goes after the last of its country, or last of all; one gone leaves it.
 *
 * @param summaries - Each city's summary, by id.
 * @param previous - The list as it was.
 * @returns The summaries, in the list's order.
 */
export const inListOrder = (summaries: CityIndex, previous: CityIndex): CityIndex => {
  const order = Object.keys(previous).filter(id => id in summaries);
  for (const [id, entry] of Object.entries(summaries)) {
    if (order.includes(id)) continue;
    const lastOfCountry = order.findLastIndex(other => summaries[other]?.country === entry.country);
    order.splice(lastOfCountry === -1 ? order.length : lastOfCountry + 1, 0, id);
  }
  return Object.fromEntries(order.map(id => [id, required(summaries[id], `city ${id}`)]));
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
 * Sums up every city and writes `cities/cities.json`, the list the site shows, keeping its order.
 *
 * @throws {z.ZodError} If the schema refuses a city's network.
 * @throws {Error} If a city is not in its country's folder.
 */
export const writeSummaries = (): void => {
  const summaries = Object.fromEntries(
    cities().map(city => {
      const network = readNetwork(city);
      if (slugOf(network.meta.country) !== city.country) throw new Error(`${city.networkPath}: its country, ${network.meta.country}, is not its folder's`);
      return [city.id, summaryOf(network)];
    }),
  );
  const previous: CityIndex = existsSync(SUMMARIES_PATH) ? JSON.parse(readFileSync(SUMMARIES_PATH, 'utf8')) : {};
  writeFileSync(SUMMARIES_PATH, formatSummaries(inListOrder(summaries, previous)));
  console.log(`${SUMMARIES_PATH}: ${Object.keys(summaries).length} cities`);
};
