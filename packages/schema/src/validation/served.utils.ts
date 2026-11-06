import type { CityBoundary } from '../format/boundary.types';
import type { Network } from '../format/network.types';

// The one door for a city's files as the browser reads them, the only assertions to these types
// (`house/served-files`). What we serve is what `data`'s tests read through `parseNetwork` and
// `parseBoundary`: validated in CI, trusted here. Parsing it again in a visitor's browser would take
// the largest city 110 to 160 ms and put Zod's 97 KB (gzipped) on every page, to catch nothing a build lets through.

/**
 * A city's network file, as we serve it: validated in CI, trusted here.
 *
 * @param file - The file, as read from JSON.
 * @returns The network, typed, its ids its own.
 */
export const servedNetwork = (file: unknown): Network => file as Network;

/**
 * A city's outline file, as we serve it: validated in CI, trusted here.
 *
 * @param file - The file, as read from JSON.
 * @returns The outline, typed.
 */
export const servedBoundary = (file: unknown): CityBoundary => file as CityBoundary;
