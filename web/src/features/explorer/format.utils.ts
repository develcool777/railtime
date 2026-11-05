import { decadeOf, yearOf } from '@railtime/core/date.utils';
import type { NetworkStats } from '@railtime/network/facts.types';
import { counted } from '~/utils/format.utils';

/** The months' names, January first. */
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
 * @returns "1930s", or "Plan" for a plan's change, which has no date.
 */
export const decadeHeading = (time: number | null): string => (time === null ? 'Plan' : `${decadeOf(yearOf(time))}s`);
