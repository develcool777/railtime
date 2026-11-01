import CITY_INDEX from '@railtime/data/cities.json';
import type { CityIndex } from '@railtime/schema/cityIndex.types';

/**
 * Every city summed up, as `pnpm data:summaries` writes them: the one list of cities, in menu order
 * (grouped by country, in the order the countries come). What the landing page and a city's page show.
 */
export const CITY_SUMMARIES: CityIndex = CITY_INDEX;

/**
 * The cities with a dataset (`data/<country>/<id>/<id>.json`, served at the same path under `/data/`),
 * in menu order. A country's folder is its name as a slug (`united-kingdom`).
 */
export const CITIES = Object.entries(CITY_SUMMARIES).map(([value, entry]) => ({ label: entry.name, value, country: entry.country }));
