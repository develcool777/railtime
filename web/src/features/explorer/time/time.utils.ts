import type { TimeState } from '@railtime/renderer/transitMap.types';

/** A year, in milliseconds, for the arrow keys. */
const YEAR_MS = 365.25 * 864e5;

/**
 * Whether the map shows the network as it is: today or, with a plan, its future built. Anywhere
 * else, the timeline is open, so the way back is in sight.
 *
 * @param time - Where the map is; `null` before it mounts, which counts as at rest.
 * @param hasPlan - A plan is shown.
 * @returns Whether it is at rest.
 */
export const isAtRest = (time: TimeState | null, hasPlan: boolean): boolean => {
  if (!time) return true;
  return hasPlan ? time.future : time.cursor === time.todayCursor && !time.future;
};

/**
 * Whether the address names the date shown: not at today, nor in a plan's future, which has no
 * date; with a plan, today too, since the plan's default is its future.
 *
 * @param time - Where the map is.
 * @param hasPlan - A plan is shown.
 * @returns Whether the date goes in the address.
 */
export const isDated = (time: TimeState | null, hasPlan: boolean): time is TimeState =>
  time !== null && !time.future && (hasPlan || time.cursor !== time.todayCursor);

/**
 * A year before or after a time, kept within the timeline.
 *
 * @param time - The time shown.
 * @param direction - Back (-1) or forward (1).
 * @param range - The timeline's ends.
 * @param range.start - Its first time.
 * @param range.end - Its last time.
 * @returns The time a year away.
 */
export const yearAway = (time: number, direction: -1 | 1, range: { start: number; end: number }): number =>
  Math.min(Math.max(time + direction * YEAR_MS, range.start), range.end);
