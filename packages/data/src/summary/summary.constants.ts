import type { IsoDate } from '@railtime/core/date.types';

/**
 * The day `cities/cities.json` counts every city as of: stated, never the clock's, so the list is what
 * its data says and a test of it cannot fail on a day no commit was made, as a future change's date
 * passes. Moved on by hand, with `pnpm data:summaries`, to count what has opened since.
 */
export const SUMMARY_DAY: IsoDate = '2026-11-01';
