import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { Network } from '@railtime/schema/network.types';
import { isPlanOnly } from '@railtime/schema/plan.utils';
import type { CityFilter } from './city.types';
import { CITIES } from './explorer.constants';

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
 * A country's folder in `data/`: its name in lower case, words joined by hyphens.
 *
 * @param country - A country, as `CITIES` names it ("United Kingdom").
 * @returns Its folder (`united-kingdom`).
 */
const countryFolderOf = (country: string): string => country.toLowerCase().replaceAll(' ', '-');

/**
 * Where a city's dataset is served, under the site's base URL (`/railtime/` on GitHub Pages).
 *
 * @param city - A city id.
 * @returns Its path, relative to the base URL: `data/<country>/<city>/<city>.json`.
 */
export const networkUrlOf = (city: string): string => {
  const country = CITIES.find(candidate => candidate.value === city)?.country ?? '';
  return `data/${countryFolderOf(country)}/${city}/${city}.json`;
};

/**
 * Where a city's preview is served, under the site's base URL: the picture `pnpm data:previews`
 * draws beside its dataset, in a theme.
 *
 * @param city - A city id.
 * @param theme - The site's colour theme.
 * @returns Its path, relative to the base URL: `data/<country>/<city>/<city>.<theme>.webp`.
 */
export const previewUrlOf = (city: string, theme: 'dark' | 'light'): string => networkUrlOf(city).replace(/\.json$/, `.${theme}.webp`);

/**
 * A city's name for display.
 *
 * @param city - A city id.
 * @returns Its name, as in the menu.
 */
export const cityNameOf = (city: string): string => CITIES.find(candidate => candidate.value === city)?.label ?? city;

/**
 * The plan a city opens on: the one asked for, if it has it; else, for a network never built, its first.
 *
 * @param network - The city's network.
 * @param asked - The plan an address names, if any.
 * @returns The plan's id, or none.
 */
export const planToOpen = (network: Network, asked: unknown): string | undefined => {
  if (typeof asked === 'string' && network.plans?.[asked]) return asked;
  return isPlanOnly(network) ? Object.keys(network.plans ?? {})[0] : undefined;
};

/**
 * Whether a city passes the landing page's search and filters. While the index loads, a city passes
 * only filters that need nothing from it.
 *
 * @param city - The city, as `CITIES` lists it.
 * @param summary - Its entry in the index, once loaded.
 * @param filter - The search and filters.
 * @returns True to show its card.
 */
export const matchesFilter = (city: (typeof CITIES)[number], summary: CityIndexEntry | null, filter: CityFilter): boolean => {
  if (filter.country && city.country !== filter.country) return false;
  const wanted = filter.query.trim().toLowerCase();
  const names = [city.label, city.country, ...(summary?.networks ?? [])].map(name => name.toLowerCase());
  if (wanted && !names.some(name => name.includes(wanted))) return false;
  if (filter.kind === 'all' && !filter.withPlans) return true;
  if (!summary) return false;
  if (filter.kind === 'history' && summary.planOnly) return false;
  if (filter.kind === 'never-built' && !summary.planOnly) return false;
  return !filter.withPlans || summary.plans > 0;
};
