/**
 * A name as a folder or an address takes it: in lower case, words joined by hyphens.
 *
 * @param name - A name ("United Kingdom").
 * @returns Its slug (`united-kingdom`).
 */
export const slugOf = (name: string): string => name.toLowerCase().trim().replaceAll(/\s+/g, '-');

/**
 * Orders two texts as `Array#sort` does when given nothing: by their UTF-16 code units, the same in
 * every browser and on every machine, which is how ids and ISO dates order. A name a reader sees is
 * ordered by `localeCompare` instead.
 *
 * @param first - One text.
 * @param second - The other.
 * @returns Below zero for the first first, above for the second, zero for the same text.
 */
export const byCodeUnits = (first: string, second: string): number => {
  if (first === second) return 0;
  return first < second ? -1 : 1;
};
