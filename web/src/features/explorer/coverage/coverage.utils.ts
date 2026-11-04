import { COVERAGE_DISTANCES } from '@railtime/network/coverage.constants';
import type { CoverageDistance } from '@railtime/network/facts.types';
import { formatNumber } from '~/utils/format.utils';

/**
 * An area as a person would read it.
 *
 * @param km2 - The area, km².
 * @returns "1,572 km²", "3.4 km²".
 */
export const formatArea = (km2: number): string => (km2 < 10 ? `${km2.toFixed(1)} km²` : `${formatNumber(km2)} km²`);

/**
 * A distance coverage may count within, from what a link or a switch gives: one of its own, or none.
 *
 * @param value - "400", 1200…
 * @returns The distance, or nothing for anything else.
 */
export const coverageDistanceOf = (value: string | number | undefined): CoverageDistance | undefined =>
  COVERAGE_DISTANCES.find(metres => String(metres) === String(value));
