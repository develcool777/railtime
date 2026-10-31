/**
 * A number as the site writes it: whole, with thousands marked.
 *
 * @param value - The value.
 * @returns "1,284".
 */
export const formatNumber = (value: number): string => Math.round(value).toLocaleString('en-GB');

/**
 * A count of something, the noun in the plural but for one.
 *
 * @param count - How many.
 * @param noun - What, in the singular.
 * @returns "1 line", "12 lines", "1,284 stations".
 */
export const counted = (count: number, noun: string): string => `${formatNumber(count)} ${noun}${Math.round(count) === 1 ? '' : 's'}`;
