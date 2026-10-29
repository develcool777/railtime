import type { IsoDate } from '@railtime/schema/network.types';

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
