import type { Network } from '@railtime/schema/network.types';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { CitySummary } from './city.types';
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
 * @returns Groups of items, as `USelect` takes them.
 */
export const cityMenu = (): ({ type: 'label'; label: string } | { label: string; value: string })[][] =>
  citiesByCountry().map(({ country, cities }) => [{ type: 'label' as const, label: country }, ...cities.map(({ label, value }) => ({ label, value }))]);

/**
 * Where a city's dataset is served, under the site's base URL (`/railtime/` on GitHub Pages).
 *
 * @param city - A city id.
 * @returns Its path, relative to the base URL.
 */
export const networkUrlOf = (city: string): string => `data/${city}/${city}.json`;

/**
 * A city's name for display.
 *
 * @param city - A city id.
 * @returns Its name, as in the menu.
 */
export const cityNameOf = (city: string): string => CITIES.find(candidate => candidate.value === city)?.label ?? city;

/**
 * Whether a city's network was never built: no track of its own, only plans.
 *
 * @param network - The city's network.
 * @returns True if it has plans and nothing else.
 */
export const isPlanOnly = (network: Network): boolean => network.segments.length === 0 && Object.keys(network.plans ?? {}).length > 0;

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
 * What a city card says about a network: its own lines, how many stations, when it began. A network
 * never built is summed up by its first plan.
 *
 * @param network - The city's network.
 * @returns The summary.
 */
export const summaryOf = (network: Network): CitySummary => {
  const planOnly = isPlanOnly(network);
  const shown = planOnly ? buildPlan(network, planToOpen(network, undefined) ?? '').network : network;
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    lines: Object.entries(shown.lines)
      .filter(([, line]) => !line.pseudo)
      .map(([id, line]) => ({ id, name: line.name, color: line.color, darkColor: line.darkColor ?? line.color })),
    stations: Object.keys(shown.stations).length,
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? Number(opened.slice(0, 4)) : null,
    planOnly,
  };
};
