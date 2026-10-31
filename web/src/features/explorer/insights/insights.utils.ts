import type { YearStats } from '@railtime/network/facts.types';

import type { GrowthMetric } from '~/features/explorer/insights/insights.types';
import { counted, formatNumber } from '~/utils/format.utils';

/**
 * One measure of the network, year by year.
 *
 * @param years - The network at the end of each year.
 * @param metric - Which measure.
 * @returns Each year with its value.
 */
export const growthSeries = (years: YearStats[], metric: GrowthMetric): { year: number; value: number }[] =>
  years.map(entry => ({ year: entry.year, value: entry[metric] }));

/**
 * A measure's value, as the page writes it.
 *
 * @param value - The value.
 * @param metric - Which measure.
 * @returns "1,284 stations", "745 km", "18 lines"; one of each in the singular.
 */
export const formatMetric = (value: number, metric: GrowthMetric): string => {
  if (metric === 'km') return `${formatNumber(value)} km`;
  return counted(value, metric === 'stations' ? 'station' : 'line');
};
