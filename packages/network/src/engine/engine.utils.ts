import { ENGINE } from './engine.constants.ts';
import type { NetworkEngine } from './engine.service';

/**
 * The raw network behind a network's facts: the renderer's door to it, which the app and the data
 * commands may not import (ESLint). Everyone else asks the facts.
 *
 * @param facts - The facts.
 * @returns Their engine.
 */
export const engineOf = (facts: { readonly [ENGINE]: NetworkEngine }): NetworkEngine => facts[ENGINE];
