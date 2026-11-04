import type { CoverageInfo } from '@railtime/network/facts.types';
import type { OverlayResult } from '@railtime/renderer/transitMap.types';

/**
 * How much of the city is within the distance of a station, if the overlay the map drew was coverage.
 *
 * @param result - What the map found for the overlay drawn, if anything.
 * @returns The coverage, or `null` for another overlay, none, or none on the date.
 */
export const foundCoverageOf = (result: OverlayResult | null): CoverageInfo | null => (result?.kind === 'coverage' ? result.coverage : null);
