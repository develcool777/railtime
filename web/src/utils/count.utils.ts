import { BLUR_PER_DIGIT, COUNT_MS, LEAST_BLUR, MOST_BLUR, SHUTTER_MS } from '~/constants/count.constants';
import type { Count, CountedSizes, Reel, ReelMark, ReelNumber } from '~/utils/count.types';
import { easedOut, fadedIn } from '~/utils/motion.utils';

/**
 * Where a number is as it counts: fast at first, slowing as it arrives, and stopping on a whole number,
 * never past it: a digit that swung past where it lands would read as a jump.
 *
 * @param from - What it counts from.
 * @param to - What it counts to.
 * @param elapsed - How long it has counted, ms.
 * @param lengthMs - How long it takes to arrive.
 * @returns Where it is.
 */
export const countedAt = (from: number, to: number, elapsed: number, lengthMs: number): number => {
  const target = Math.round(to);
  return elapsed >= lengthMs ? target : from + (target - from) * easedOut(fadedIn(elapsed, lengthMs));
};

/**
 * A number as it counts this frame, and as the shutter opened.
 *
 * @param from - What it counts from.
 * @param to - What it counts to.
 * @param elapsed - How long it has counted, ms.
 * @param lengthMs - How long it takes to arrive.
 * @returns The count.
 */
export const countOf = (from: number, to: number, elapsed: number, lengthMs: number = COUNT_MS): Count => ({
  now: countedAt(from, to, elapsed, lengthMs),
  before: countedAt(from, to, elapsed - SHUTTER_MS, lengthMs),
});

/**
 * Everything the year card counts, this frame.
 *
 * @param from - What they count from.
 * @param to - What they count to.
 * @param elapsed - How long they have counted, ms.
 * @returns Each count.
 */
export const countsOf = (from: CountedSizes, to: CountedSizes, elapsed: number): Record<keyof CountedSizes, Count> => ({
  stations: countOf(from.stations, to.stations, elapsed),
  km: countOf(from.km, to.km, elapsed),
  lines: countOf(from.lines, to.lines, elapsed),
  year: countOf(from.year, to.year, elapsed),
});

/**
 * Where the year card's numbers are this frame, for a count on from them.
 *
 * @param counts - Each count.
 * @returns Where each is.
 */
export const sizesAt = ({ stations, km, lines, year }: Record<keyof CountedSizes, Count>): CountedSizes => ({
  stations: stations.now,
  km: km.now,
  lines: lines.now,
  year: year.now,
});

/**
 * A share as `formatShare` writes it, for reels: a whole percentage, or with one decimal under 10.
 *
 * @param share - 0..1.
 * @returns Its digits, and how many follow the point.
 */
export const shareNumberOf = (share: number): ReelNumber => {
  const tenths = Math.round(share * 1000);
  if (share === 0 || tenths >= 100) return { value: Math.round(share * 100), decimals: 0 };
  return { value: tenths, decimals: 1 };
};

/**
 * How far a reel has turned for a number, as an odometer's does: the last digit turns with the number,
 * and each one before it only as the digits after it go from all nines to noughts.
 *
 * @param value - The number.
 * @param place - The reel's place: 0 for the last digit.
 * @returns How many digits it has turned through.
 */
const turnedAt = (value: number, place: number): number => {
  const span = 10 ** place;
  const turns = Math.floor(value / span);
  return turns + fadedIn(value - turns * span - (span - 1), 1);
};

/**
 * A reel this frame.
 *
 * @param count - The number.
 * @param place - Its place: 0 for the last digit.
 * @param width - How much of a reel wide it is.
 * @returns The reel.
 */
const reelOf = ({ now, before }: Count, place: number, width: number): Reel => {
  const turned = turnedAt(now, place);
  const digit = Math.floor(turned) % 10;
  const blur = Math.min(MOST_BLUR, Math.abs(turned - turnedAt(before, place)) * BLUR_PER_DIGIT);
  return { key: `reel${place}`, mark: null, digit, next: (digit + 1) % 10, offset: turned % 1, width, blur: blur < LEAST_BLUR ? 0 : blur };
};

/**
 * A number as reels, left to right. A digit it has not reached has no reel; one it is reaching slides
 * in, as wide as it has got, with the comma before it.
 *
 * @param count - The number.
 * @param options - How it is written.
 * @param options.decimals - How many of its last digits follow a point.
 * @param options.grouped - Whether commas part its thousands.
 * @returns Its reels and marks.
 */
export const reelsOf = (count: Count, { decimals = 0, grouped = true } = {}): (Reel | ReelMark)[] => {
  const least = decimals + 1;
  const places = Math.max(least, String(Math.floor(count.now)).length + 1);
  const parts: (Reel | ReelMark)[] = [];
  for (let place = 0; place < places; place++) {
    const width = place < least ? 1 : fadedIn(count.now - (10 ** place - 1), 1);
    if (width <= 0) continue;
    const whole = place - decimals;
    if (decimals > 0 && whole === 0) parts.push({ key: 'point', mark: '.', width: 1 });
    if (grouped && whole > 0 && whole % 3 === 0) parts.push({ key: `comma${place}`, mark: ',', width });
    parts.push(reelOf(count, place, width));
  }
  return parts.toReversed();
};
