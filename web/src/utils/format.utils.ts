import type { LineColor } from '@railtime/network/facts.types';
import { shareNumberOf } from '~/utils/count.utils';

/**
 * A number as the site writes it: whole, with thousands marked.
 *
 * @param value - The value.
 * @returns "1,284".
 */
export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-GB');

/**
 * A noun as a count of it reads.
 *
 * @param count - The count.
 * @param noun - The noun: "station".
 * @returns "station", or "stations".
 */
export const pluralOf = (count: number, noun: string): string => `${noun}${Math.round(count) === 1 ? '' : 's'}`;

/**
 * A count of something, the noun in the plural but for one.
 *
 * @param count - How many.
 * @param noun - What, in the singular.
 * @returns "1 line", "12 lines", "1,284 stations".
 */
export const counted = (count: number, noun: string): string => `${formatNumber(count)} ${pluralOf(count, noun)}`;

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
  const { value, decimals } = shareNumberOf(share);
  return `${(value / 10 ** decimals).toFixed(decimals)}%`;
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
