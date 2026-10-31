import { parseNetwork } from '@railtime/schema/network.schema';
import type { Network } from '@railtime/schema/network.types';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { City } from './city.types.ts';

/** The package's `cities/` folder: each country's cities, `<country>/<city>/<city>.json`. */
const CITIES_FOLDER = fileURLToPath(new URL('../cities/', import.meta.url));

/** Where every city's summary is kept, beside the countries: the list the landing page shows. */
export const SUMMARIES_PATH = `${CITIES_FOLDER}cities.json`;

/**
 * Every city kept, by country then city.
 *
 * @returns Each city and where its files are.
 */
export const cities = (): City[] =>
  globSync('*/*/*.json', { cwd: CITIES_FOLDER })
    .map(path => path.split('/'))
    .filter(([, id, file]) => file === `${id}.json`)
    .map(([country = '', id = '']) => {
      const base = `${CITIES_FOLDER}${country}/${id}/${id}`;
      return { country, id, networkPath: `${base}.json`, boundaryPath: `${base}.boundary.json` };
    })
    .sort((first, second) => first.networkPath.localeCompare(second.networkPath));

/**
 * The cities a command was asked for.
 *
 * @param id - A city's id, or none for every city.
 * @returns That city, every city, or none if no city has the id.
 */
export const citiesNamed = (id: string | undefined): City[] => cities().filter(city => id === undefined || city.id === id);

/**
 * A city's network, read and checked against the schema.
 *
 * @param city - The city.
 * @returns Its network.
 * @throws {z.ZodError} If the file breaks the schema.
 */
export const readNetwork = (city: City): Network => parseNetwork(JSON.parse(readFileSync(city.networkPath, 'utf8')));
