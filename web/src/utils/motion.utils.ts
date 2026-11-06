/**
 * How far something shown has faded in: 0 before it starts, rising to 1 over the fade.
 *
 * @param elapsed - How long since it started to show, ms; negative before.
 * @param fadeMs - How long its fade takes.
 * @returns Its opacity, 0 to 1.
 */
export const fadedIn = (elapsed: number, fadeMs: number): number => Math.min(1, Math.max(0, elapsed / fadeMs));

/**
 * Slows something down as it arrives.
 *
 * @param share - How far it has got at an even pace, 0 to 1.
 * @returns How far it has got, 0 to 1.
 */
export const easedOut = (share: number): number => 1 - (1 - share) ** 3;
