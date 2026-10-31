/**
 * A value held within bounds.
 *
 * @param value - The value.
 * @param min - The lowest it may be.
 * @param max - The highest it may be.
 * @returns `value`, clamped.
 */
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
