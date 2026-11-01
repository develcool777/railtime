import { COVERAGE_DISTANCES } from '@railtime/network/coverage.constants';
import type { CoverageDistance } from '@railtime/network/facts.types';
import { formatNumber } from '~/utils/format.utils';

/**
 * A share as a whole percentage, or with one decimal while it is under 10.
 *
 * @param share - 0..1.
 * @returns "34%", "4.2%", "0%"; "10%" for 9.96%.
 */
export const formatShare = (share: number): string => {
  const percent = share * 100;
  if (percent === 0) return '0%';
  // Rounded first, so 9.96% reads as 10%, not 10.0%.
  const tenths = Math.round(percent * 10) / 10;
  return tenths < 10 ? `${tenths.toFixed(1)}%` : `${Math.round(percent)}%`;
};

/**
 * An area as a person would read it.
 *
 * @param km2 - The area, km².
 * @returns "1,572 km²", "3.4 km²".
 */
export const formatArea = (km2: number): string => (km2 < 10 ? `${km2.toFixed(1)} km²` : `${formatNumber(km2)} km²`);

/**
 * A walk from a station, as the coverage switch and its sentences say it.
 *
 * @param metres - The distance.
 * @returns "400 m", "1.2 km".
 */
export const formatWalk = (metres: number): string => (metres < 1000 ? `${metres} m` : `${metres / 1000} km`);

/**
 * A distance coverage may count within, from what a link or a switch gives: one of its own, or none.
 *
 * @param value - "400", 1200…
 * @returns The distance, or nothing for anything else.
 */
export const coverageDistanceOf = (value: string | number | undefined): CoverageDistance | undefined =>
  COVERAGE_DISTANCES.find(metres => String(metres) === String(value));
