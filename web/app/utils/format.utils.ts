import type { FormerNameInfo } from '@railtime/renderer/transitMap.types';

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
 * A month as people write it.
 *
 * @param time - A timestamp.
 * @returns "December 1968".
 */
export const formatMonth = (time: number): string => {
  const date = new Date(time);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
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
 * A station's earlier names, in a line.
 *
 * @param formerNames - Its earlier names, oldest first.
 * @returns "Formerly G-Mex (until 2010)", each with its names in other languages after a slash, or an empty string for none.
 */
export const formatFormerNames = (formerNames: FormerNameInfo[]): string => {
  const names = formerNames.map(former => `${[former.name, ...former.otherNames].join(' / ')} (until ${former.until.slice(0, 4)})`);
  return names.length > 0 ? `Formerly ${names.join(', ')}` : '';
};

/**
 * What a plan adds, in a line.
 *
 * @param stations - Its new stations.
 * @param km - Its new track, km.
 * @returns "+4 stations · +6 km", leaving out what it adds none of.
 */
export const formatPlanFacts = (stations: number, km: number): string => {
  const facts: string[] = [];
  if (stations > 0) facts.push(`+${stations} station${stations === 1 ? '' : 's'}`);
  if (Math.round(km) > 0) facts.push(`+${Math.round(km)} km`);
  return facts.join(' · ');
};
