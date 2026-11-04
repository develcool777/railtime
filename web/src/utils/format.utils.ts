import type { LineColor } from '@railtime/network/facts.types';

/**
 * A number as the site writes it: whole, with thousands marked.
 *
 * @param value - The value.
 * @returns "1,284".
 */
export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-GB');

/**
 * A count of something, the noun in the plural but for one.
 *
 * @param count - How many.
 * @param noun - What, in the singular.
 * @returns "1 line", "12 lines", "1,284 stations".
 */
export const counted = (count: number, noun: string): string => `${formatNumber(count)} ${noun}${Math.round(count) === 1 ? '' : 's'}`;

/**
 * A line's colour as CSS, in whichever theme the page is in: the browser picks by the page's
 * `color-scheme` (`main.css`), so it changes with the theme without asking the network again.
 *
 * @param color - The line's colour in each theme.
 * @returns A `light-dark()` colour.
 */
export const lineColor = (color: LineColor): string => `light-dark(${color.light}, ${color.dark})`;

/**
 * A share as a whole percentage, or with one decimal while it is under 10.
 *
 * @param share - 0..1.
 * @returns "34%", "4.2%", "0%"; "10%" for 9.96%.
 */
export const formatShare = (share: number): string => {
  const percent = share * 100;
  if (percent === 0) return '0%';
  // Rounded first, so 9.96% reads as 10%, not 10.0%.
  const tenths = Math.round(percent * 10) / 10;
  return tenths < 10 ? `${tenths.toFixed(1)}%` : `${Math.round(percent)}%`;
};

/**
 * A walk from a station, as the coverage switch and its sentences say it.
 *
 * @param metres - The distance.
 * @returns "400 m", "1.2 km".
 */
export const formatWalk = (metres: number): string => (metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

/**
 * What a plan adds, in a line.
 *
 * @param stations - Its new stations.
 * @param km - Its new track, km.
 * @returns "adds 4 stations · 6 km", leaving out what it adds none of; empty if it adds neither.
 */
export const formatPlanFacts = (stations: number, km: number): string => {
  const facts: string[] = [];
  if (stations > 0) facts.push(counted(stations, 'station'));
  if (Math.round(km) > 0) facts.push(`${Math.round(km)} km`);
  return facts.length > 0 ? `adds ${facts.join(' · ')}` : '';
};
