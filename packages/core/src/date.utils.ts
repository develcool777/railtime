import type { IsoDate } from './date.types';

/** Milliseconds in a day. */
export const DAY_MS = 864e5;

/** Milliseconds in an average year. */
export const YEAR_MS = 365.25 * DAY_MS;

/**
 * The UTC midnight of an ISO date.
 *
 * @param date - A `YYYY-MM-DD` date.
 * @returns Its timestamp.
 */
export const toTimestamp = (date: IsoDate): number => {
  const [year = NaN, month = NaN, day = NaN] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

/**
 * The ISO date of a timestamp, in UTC.
 *
 * @param timestamp - Milliseconds since the epoch.
 * @returns Its `YYYY-MM-DD` date.
 */
export const toIsoDate = (timestamp: number): IsoDate => new Date(timestamp).toISOString().slice(0, 10);

/**
 * Today's UTC midnight.
 *
 * @returns Its timestamp.
 */
export const todayTimestamp = (): number => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

/**
 * The year of a timestamp, in UTC.
 *
 * @param timestamp - Milliseconds since the epoch.
 * @returns Its year.
 */
export const yearOf = (timestamp: number): number => new Date(timestamp).getUTCFullYear();

/**
 * The last day of a year: what a year shown means, the network as it stood when the year ended.
 *
 * @param year - The year.
 * @returns The UTC midnight of its 31 December.
 */
export const endOfYear = (year: number): number => Date.UTC(year, 11, 31);

/**
 * The decade a year is in, by its first year.
 *
 * @param year - The year.
 * @returns 1960 for any year of the 1960s.
 */
export const decadeOf = (year: number): number => Math.floor(year / 10) * 10;
