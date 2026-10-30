import type { NetworkStats } from '@railtime/renderer/transitMap.types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The year of a timestamp, in UTC.
 *
 * @param time - A timestamp.
 * @returns Its year.
 */
export const yearOf = (time: number): number => new Date(time).getUTCFullYear();

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
 * When a line served a station.
 *
 * @param opened - ISO date it opened there, or `null` for a plan's line, which has none.
 * @param closed - ISO date it closed there, if it has.
 * @returns "since 1906", "1906–1994" or "planned".
 */
export const formatSpan = (opened: string | null, closed?: string): string => {
  if (opened === null) return 'planned';
  return closed ? `${opened.slice(0, 4)}–${closed.slice(0, 4)}` : `since ${opened.slice(0, 4)}`;
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
  if (stations > 0) facts.push(`${stations} station${stations === 1 ? '' : 's'}`);
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
  return `${stats.stations} station${stats.stations === 1 ? '' : 's'} · ${km} · ${stats.lines} line${stats.lines === 1 ? '' : 's'}`;
};

/**
 * The decade a timestamp falls in, as a heading.
 *
 * @param time - A timestamp; `null` for a plan's change, which has no date.
 * @returns "1930s", or "Future".
 */
export const decadeOf = (time: number | null): string => (time === null ? 'Future' : `${Math.floor(yearOf(time) / 10) * 10}s`);
