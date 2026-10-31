/**
 * Slow in, slow out.
 *
 * @param fraction - Linear progress, 0..1.
 * @returns Eased progress, 0..1.
 */
export const easeInOut = (fraction: number): number => -(Math.cos(Math.PI * fraction) - 1) / 2;

/** How far `easeOutBack` overshoots. */
const OVERSHOOT = 1.70158;

/**
 * Overshoots a little, then settles: a pop-in.
 *
 * @param fraction - Linear progress, 0..1.
 * @returns Eased progress, peaking slightly above 1 before ending on 1.
 */
export const easeOutBack = (fraction: number): number => 1 + (OVERSHOOT + 1) * (fraction - 1) ** 3 + OVERSHOOT * (fraction - 1) ** 2;
