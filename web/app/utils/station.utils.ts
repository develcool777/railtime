import type { StationSummary } from '@railtime/renderer/transitMap.types';

/**
 * A name as a search compares it: lower case, accents and apostrophes dropped, so "kings cross"
 * finds "King's Cross" and "namesti miru" finds "Náměstí Míru".
 *
 * @param text - A name or a query.
 * @returns The text, folded.
 */
export const foldName = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’ʼ.]/g, '')
    .toLowerCase()
    .trim();

/**
 * The stations whose name, in any language, holds a query: those it begins first, then those with
 * a word it begins, then the rest, each by name.
 *
 * @param stations - The stations to look through.
 * @param query - What was typed.
 * @param limit - How many to return at most.
 * @returns The matches, best first; none for an empty query.
 */
export const findStations = (stations: StationSummary[], query: string, limit: number): StationSummary[] => {
  const wanted = foldName(query);
  if (!wanted) return [];
  const ranked = stations
    .map(station => {
      const names = [station.name, ...station.otherNames].map(foldName);
      // Best when a name begins with the query; then when a word of it does; then anywhere.
      if (names.some(name => name.startsWith(wanted))) return { station, rank: 0 };
      if (names.some(name => name.includes(` ${wanted}`))) return { station, rank: 1 };
      return { station, rank: names.some(name => name.includes(wanted)) ? 2 : null };
    })
    .filter((entry): entry is { station: StationSummary; rank: number } => entry.rank !== null);
  return ranked
    .sort((first, second) => first.rank - second.rank || first.station.name.localeCompare(second.station.name))
    .slice(0, limit)
    .map(entry => entry.station);
};
