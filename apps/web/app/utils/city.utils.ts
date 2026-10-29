import type { Network } from '@railtime/schema/network.types';
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
 * Where a city's dataset is served.
 *
 * @param city - A city id.
 * @returns Its URL.
 */
export const networkUrlOf = (city: string): string => `/data/${city}/${city}.json`;

/**
 * A city's name for display.
 *
 * @param city - A city id.
 * @returns Its name, as in the menu.
 */
export const cityNameOf = (city: string): string => CITIES.find(candidate => candidate.value === city)?.label ?? city;

/**
 * What a city card says about a network: its own lines, how many stations, when it began.
 *
 * @param network - The city's network.
 * @returns The summary.
 */
export const summaryOf = (network: Network): CitySummary => {
  const opened = network.segments.flatMap(segment => Object.values(segment.lines).map(dates => dates.open)).sort()[0];
  return {
    lines: Object.entries(network.lines)
      .filter(([, line]) => !line.pseudo)
      .map(([id, line]) => ({ id, name: line.name, color: line.color, darkColor: line.darkColor ?? line.color })),
    stations: Object.keys(network.stations).length,
    networks: Object.values(network.networks).map(brand => brand.name),
    openedYear: opened ? Number(opened.slice(0, 4)) : null,
  };
};
