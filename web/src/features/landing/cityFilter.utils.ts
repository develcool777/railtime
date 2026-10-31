import type { CityIndexEntry } from '@railtime/schema/cityIndex.types';
import type { CITIES } from '~/constants/city.constants';
import type { CityFilter } from './cityFilter.types';

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

/** The filters as the page opens: every city shown. */
export const NO_FILTER: CityFilter = { query: '', country: '', kind: 'all', withPlans: false };

/**
 * Whether any filter narrows the list: a search, a country, a kind, or plans only.
 *
 * @param filter - The filters.
 * @returns True if some city could be left out.
 */
export const isFiltering = (filter: CityFilter): boolean => filter.query.trim() !== '' || filter.country !== '' || filter.kind !== 'all' || filter.withPlans;
