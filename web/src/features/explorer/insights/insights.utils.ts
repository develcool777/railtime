import type { NetworkGrowth, YearStats } from '@railtime/renderer/transitMap.types';

import type { GrowthMetric } from '~/features/explorer/insights/insights.types';

/**
 * Clean ticks for an axis from nought to past the highest value: steps of 1, 2 or 5 times a power of
 * ten, about `count` of them.
 *
 * @param max - The highest value.
 * @param count - About how many steps.
 * @returns The ticks, nought first; the last is at or above `max`.
 */
export const niceTicks = (max: number, count = 3): number[] => {
  if (max <= 0) return [0];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(factor => factor * power).find(candidate => candidate >= rough) ?? 10 * power;
  const steps = Math.ceil(max / step);
  return Array.from({ length: steps + 1 }, (_, position) => position * step);
};

/**
 * The years to mark along a timeline's axis: round ones, spaced by how long it runs.
 *
 * @param first - Its first year.
 * @param last - Its last year.
 * @returns The years marked, in order.
 */
export const yearTicks = (first: number, last: number): number[] => {
  const span = last - first;
  // The longest span first: 50 years apart over 120, 25 over 50, 10 over 20, else 5.
  const spacing =
    [
      { over: 120, spacing: 50 },
      { over: 50, spacing: 25 },
      { over: 20, spacing: 10 },
    ].find(entry => span > entry.over)?.spacing ?? 5;
  const ticks: number[] = [];
  for (let year = Math.ceil(first / spacing) * spacing; year <= last; year += spacing) ticks.push(year);
  return ticks;
};

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
 * Whether a network has a history to show: some year with a station on the map. One never built has
 * only its plans.
 *
 * @param growth - The network's growth.
 * @returns True if any year has a station.
 */
export const hasHistory = (growth: NetworkGrowth): boolean => growth.years.some(entry => entry.stations > 0);
