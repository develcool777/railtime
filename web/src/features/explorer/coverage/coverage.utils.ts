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
