import { REACH_BANDS } from './reach.constants';

/**
 * The band a time falls in: the last has no end, so every time finds one.
 *
 * @param minutes - How long it takes.
 * @returns The band's place in `REACH_BANDS`.
 */
export const bandOf = (minutes: number): number => REACH_BANDS.findIndex(entry => entry.upTo === null || minutes <= entry.upTo);
