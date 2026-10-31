import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Dataset } from './city.types.ts';

/** The package's `cities/` folder: each country's cities, `<country>/<city>/<city>.json`. */
const DATA = fileURLToPath(new URL('../../cities/', import.meta.url));

/** Where the index of every city is kept, beside the countries. */
export const CITY_INDEX_PATH = `${DATA}cities.json`;

/**
 * Every city's dataset, by country then city.
 *
 * @returns Each dataset's country, city and path.
 */
export const datasets = (): Dataset[] =>
  globSync('*/*/*.json', { cwd: DATA })
    .map(path => path.split('/'))
    .filter(([, city, file]) => file === `${city}.json`)
    .map(([country = '', city = '', file = '']) => ({ country, city, path: `${DATA}${country}/${city}/${file}` }))
    .sort((first, second) => first.path.localeCompare(second.path));

/**
 * Where a city's outline is kept, beside its dataset: `<city>.boundary.json`. Not every city has one yet.
 *
 * @param dataset - The city's dataset.
 * @returns The outline's path.
 */
export const boundaryPathOf = (dataset: Pick<Dataset, 'path'>): string => dataset.path.replace(/\.json$/, '.boundary.json');

/**
 * The city a command was run for: its first argument, which must name a city in `cities/` with a
 * dataset. Exits with the usage otherwise.
 *
 * @param command - The command's name, for the usage line (`format` for `pnpm data:format <city>`).
 * @returns The city's dataset.
 */
export const cityArgument = (command: string): Dataset => {
  const dataset = datasets().find(candidate => candidate.city === process.argv[2]);
  if (dataset) return dataset;
  console.error(`usage: pnpm data:${command} <city>, where cities/<country>/<city>/<city>.json exists`);
  process.exit(1);
};
