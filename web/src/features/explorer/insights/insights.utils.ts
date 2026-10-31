import type { NetworkGrowth, YearStats } from '@railtime/renderer/transitMap.types';

import type { GrowthMetric } from '~/features/explorer/insights/insights.types';

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
  const rounded = Math.round(value);
  const number = rounded.toLocaleString('en-GB');
  if (metric === 'km') return `${number} km`;
  const noun = metric === 'stations' ? 'station' : 'line';
  const plural = rounded === 1 ? noun : noun + 's';
  return `${number} ${plural}`;
};

/**
 * A value as an axis or a readout writes it: whole, with thousands marked.
 *
 * @param value - The value.
 * @returns "1,284".
 */
export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-GB');
