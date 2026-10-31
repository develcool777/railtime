/**
 * A colour's red, green and blue.
 *
 * @param hex - `#rrggbb`.
 * @returns Its channels, 0..255.
 */
export const channelsOf = (hex: string): [number, number, number] =>
  [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
