import { describe, expect, test } from 'vitest';
import { LEAST_BLUR, MOST_BLUR, SHUTTER_MS } from '~/constants/count.constants';
import type { Count, Reel, ReelMark } from '~/utils/count.types';
import { countedAt, countOf, countsOf, reelsOf, shareNumberOf, sizesAt } from '~/utils/count.utils';
import { formatShare } from '~/utils/format.utils';

/** How long a count takes, ms, where it makes no odds. */
const LENGTH = 1000;

/**
 * A number standing still.
 *
 * @param value - The number.
 * @returns Its count.
 */
const still = (value: number): Count => ({ now: value, before: value });

/**
 * The reels of a number, without its marks.
 *
 * @param parts - What `reelsOf` gave.
 * @returns The reels.
 */
const reelsIn = (parts: (Reel | ReelMark)[]): Reel[] => parts.filter((part): part is Reel => part.mark === null);

/**
 * A number as it reads at rest.
 *
 * @param parts - What `reelsOf` gave.
 * @returns It as text.
 */
const textOf = (parts: (Reel | ReelMark)[]): string => parts.map(part => part.mark ?? part.digit).join('');

describe('CountUtils', () => {
  describe('countedAt', () => {
    test('starts where it counts from, and lands on a whole number', () => {
      expect(countedAt(10, 20, 0, LENGTH)).toBe(10);
      expect(countedAt(10, 20.4, LENGTH, LENGTH)).toBe(20);
    });

    test('slows as it arrives', () => {
      const firstHalf = countedAt(0, 100, LENGTH / 2, LENGTH);
      expect(firstHalf).toBeGreaterThan(50);
    });

    test.each([
      [6, 10],
      [1995, 1996],
      [12, 10],
    ])('slows all the way from %s to %s, never speeding up or going past where it lands', (from, to) => {
      const moments = Array.from({ length: LENGTH / 10 + 1 }, (_, moment) => countedAt(from, to, moment * 10, LENGTH));
      const steps = moments.slice(1).map((moment, place) => Math.abs(moment - (moments[place] ?? 0)));
      expect(moments.filter(moment => (moment - to) * Math.sign(to - from) > 0)).toEqual([]);
      expect(steps.slice(1).filter((step, place) => step > (steps[place] ?? 0) + 1e-9)).toEqual([]);
    });

    test('stands still where there is nothing to count', () => {
      expect(countedAt(5, 5, LENGTH * 0.9, LENGTH)).toBe(5);
    });

    test('rests on it for ever, so a scene over has no motion', () => {
      expect(countedAt(0, 100, Infinity, LENGTH)).toBe(100);
    });
  });

  describe('countOf', () => {
    test('says where it was as the shutter opened', () => {
      expect(countOf(0, 100, 200, LENGTH)).toEqual({ now: countedAt(0, 100, 200, LENGTH), before: countedAt(0, 100, 200 - SHUTTER_MS, LENGTH) });
    });

    test('has no motion at rest', () => {
      const { now, before } = countOf(0, 100, Infinity, LENGTH);
      expect(now).toBe(before);
    });
  });

  describe('countsOf', () => {
    test('counts each of the sizes, and `sizesAt` says where each is', () => {
      const from = { stations: 0, km: 10, lines: 1, year: 1960 };
      const to = { stations: 5, km: 20, lines: 2, year: 1970 };
      expect(sizesAt(countsOf(from, to, 0))).toEqual(from);
      expect(sizesAt(countsOf(from, to, Infinity))).toEqual(to);
    });
  });

  describe('shareNumberOf', () => {
    test.each([0, 0.004, 0.042, 0.0996, 0.1, 0.34, 1])('writes %s as `formatShare` does', share => {
      const { value, decimals } = shareNumberOf(share);
      expect(`${textOf(reelsOf(still(value), { decimals }))}%`).toBe(formatShare(share));
    });
  });

  describe('reelsOf', () => {
    test('reads as the number at rest, each reel square in its window', () => {
      const parts = reelsOf(still(407));
      expect(textOf(parts)).toBe('407');
      expect(reelsIn(parts).map(({ offset }) => offset)).toEqual([0, 0, 0]);
    });

    test('shows nought for nothing', () => {
      expect(textOf(reelsOf(still(0)))).toBe('0');
    });

    test('parts thousands with commas, unless told not to, as a year', () => {
      expect(textOf(reelsOf(still(1_234_567)))).toBe('1,234,567');
      expect(textOf(reelsOf(still(1995), { grouped: false }))).toBe('1995');
    });

    test('keeps a point and a digit before it', () => {
      expect(textOf(reelsOf(still(4), { decimals: 1 }))).toBe('0.4');
      expect(textOf(reelsOf(still(42), { decimals: 1 }))).toBe('4.2');
    });

    test('turns the last digit with the number, and leaves the next until it comes round', () => {
      const [tens, units] = reelsIn(reelsOf(still(23.5)));
      expect(units).toMatchObject({ digit: 3, next: 4, offset: 0.5 });
      expect(tens).toMatchObject({ digit: 2, offset: 0 });
    });

    test('carries as an odometer does: every reel turning together from nines to noughts', () => {
      const [hundreds, tens, units] = reelsIn(reelsOf(still(199.5)));
      expect([hundreds?.offset, tens?.offset, units?.offset]).toEqual([0.5, 0.5, 0.5]);
      expect(hundreds).toMatchObject({ digit: 1, next: 2 });
      expect(tens).toMatchObject({ digit: 9, next: 0 });
    });

    test('slides a new digit in as the number reaches it, and its comma with it', () => {
      const parts = reelsOf(still(999.5));
      expect(parts[0]).toMatchObject({ digit: 0, width: 0.5 });
      expect(parts[1]).toMatchObject({ mark: ',', width: 0.5 });
      expect(reelsIn(reelsOf(still(98.5)))).toHaveLength(2);
    });

    test('keeps a reel still sharp, and blurs one by how far it turned as the shutter was open', () => {
      const [tens, units] = reelsIn(reelsOf({ now: 21.5, before: 21 }));
      expect(tens?.blur).toBe(0);
      expect(units?.blur).toBeGreaterThan(LEAST_BLUR);
      expect(reelsIn(reelsOf(still(21))).map(({ blur }) => blur)).toEqual([0, 0]);
    });

    test('smears a reel spinning fast no further than the most', () => {
      const [units] = reelsIn(reelsOf({ now: 9, before: 2 })).slice(-1);
      expect(units?.blur).toBe(MOST_BLUR);
    });
  });
});
