import { required } from '@railtime/core/required.utils';
import { slugOf } from '@railtime/core/text.utils';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import { servedBoundary } from '@railtime/schema/served.utils';
import { CITIES, CITY_SUMMARIES } from '~/constants/city.constants';

/**
 * Whether a city has a dataset: what a city page's address must name.
 *
 * @param city - A route parameter or query value.
 * @returns True for a city in `CITIES`.
 */
export const isCity = (city: unknown): city is string => CITIES.some(candidate => candidate.value === city);

/**
 * The cities by country, in menu order.
 *
 * @returns Each country with its cities.
 */
export const citiesByCountry = (): { country: string; cities: typeof CITIES }[] => {
  const countries: { country: string; cities: typeof CITIES }[] = [];
  for (const city of CITIES) {
    const group = countries.find(entry => entry.country === city.country);
    if (group) group.cities.push(city);
    else countries.push({ country: city.country, cities: [city] });
  }
  return countries;
};

/**
 * The city menu: each country a labelled group.
 *
 * @returns Groups of items, as `USelectMenu` takes them: a label, then the cities.
 */
export const cityMenu = (): { type?: 'label'; label: string; value?: string }[][] =>
  citiesByCountry().map(({ country, cities }) => [{ type: 'label' as const, label: country }, ...cities.map(({ label, value }) => ({ label, value }))]);

/**
 * Where a city's dataset is served, under the site's base URL.
 *
 * @param city - A city id.
 * @returns Its path, relative to the base URL: `data/<country>/<city>/<city>.json`.
 * @throws {Error} For a city not in the catalogue.
 */
export const networkUrlOf = (city: string): string => {
  const { country } = required(
    CITIES.find(candidate => candidate.value === city),
    `city ${city}`,
  );
  return `data/${slugOf(country)}/${city}/${city}.json`;
};

/**
 * Where a city's outline is served, under the site's base URL: beside its dataset, if it has one.
 *
 * @param city - A city id.
 * @returns The path, relative to the base URL.
 */
export const boundaryUrlOf = (city: string): string => networkUrlOf(city).replace(/\.json$/, '.boundary.json');

/**
 * Where a city's preview is served, under the site's base URL: the picture `pnpm data:previews`
 * draws beside its dataset, in a theme.
 *
 * @param city - A city id.
 * @param theme - The site's colour theme.
 * @returns Its path, relative to the base URL: `data/<country>/<city>/<city>.<theme>.webp`.
 */
export const previewUrlOf = (city: string, theme: 'dark' | 'light'): string => networkUrlOf(city).replace(/\.json$/, () => `.${theme}.webp`);

/**
 * Where a city's social card is served, under the site's base URL: the picture `pnpm data:previews`
 * draws beside its dataset.
 *
 * @param city - A city id.
 * @returns Its path, relative to the base URL: `data/<country>/<city>/<city>.social.jpg`.
 */
export const socialUrlOf = (city: string): string => networkUrlOf(city).replace(/\.json$/, '.social.jpg');

/**
 * A city's name for display.
 *
 * @param city - A city id.
 * @returns Its name, as in the menu.
 */
export const cityNameOf = (city: string): string => CITIES.find(candidate => candidate.value === city)?.label ?? city;

/**
 * A city's summary: its lines, stations, plans, when it began.
 *
 * @param city - A city in `CITIES`.
 * @returns Its entry in `cities.json`.
 * @throws {Error} If it has none.
 */
export const citySummaryOf = (city: string): CityIndexEntry => {
  const entry = CITY_SUMMARIES[city];
  if (!entry) throw new Error(`${city} is not in cities.json`);
  return entry;
};

/**
 * A city's outline, fetched.
 *
 * @param url - Where it is served.
 * @returns The outline, or `null` where there is none: not every city has one yet.
 */
export const fetchBoundary = async (url: string): Promise<CityBoundary | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return servedBoundary(await response.json());
  } catch {
    return null;
  }
};

/**
 * A city's outline, fetched for whoever asked for it, and handed over only if that is still what they
 * ask: one that comes once another city is open is dropped, as that city fetches its own.
 *
 * @param url - Where it is served.
 * @param asked - Where the outline is wanted now, as the answer comes.
 * @param take - What is done with the outline, or `null` where there is none.
 */
export const fetchAskedBoundary = async (url: string, asked: () => string | null, take: (outline: CityBoundary | null) => void): Promise<void> => {
  const outline = await fetchBoundary(url);
  if (asked() === url) take(outline);
};
