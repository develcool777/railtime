import type { LineColor, NetworkStats } from '@railtime/network/facts.types';
import { decadeOf, yearOf } from '@railtime/core/date.utils';

import { counted } from '~/utils/format.utils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * A day as people write it.
 *
 * @param time - A timestamp.
 * @returns "1 December 1968".
 */
export const formatDay = (time: number): string => {
  const date = new Date(time);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

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

/**
 * What is on the map, in a line.
 *
 * @param stats - Its stations, track and lines.
 * @param short - For a narrow screen: the stations abbreviated, the lines left out.
 * @returns "384 stations · 745 km · 20 lines", or "384 st. · 745 km".
 */
export const formatStats = (stats: NetworkStats, short = false): string => {
  const km = `${Math.round(stats.km)} km`;
  if (short) return `${stats.stations} st. · ${km}`;
  return `${counted(stats.stations, 'station')} · ${km} · ${counted(stats.lines, 'line')}`;
};

/**
 * The decade a timestamp falls in, as a heading.
 *
 * @param time - A timestamp; `null` for a plan's change, which has no date.
 * @returns "1930s", or "Future".
 */
export const decadeHeading = (time: number | null): string => (time === null ? 'Future' : `${decadeOf(yearOf(time))}s`);

/**
 * A line's colour as CSS, in whichever theme the page is in: the browser picks by the page's
 * `color-scheme` (`main.css`), so it changes with the theme without asking the network again.
 *
 * @param color - The line's colour in each theme.
 * @returns A `light-dark()` colour.
 */
export const lineColor = (color: LineColor): string => `light-dark(${color.light}, ${color.dark})`;
