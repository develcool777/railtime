import type { LineDirection, StationSummary, StopToward } from '@railtime/network/facts.types';

import type { StationGroup, StripStop } from '~/features/explorer/stations/station.types';

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

/**
 * The stations A to Z, under the first letter of their names (accents dropped, so "Náměstí" is
 * under N).
 *
 * @param stations - The stations on the map.
 * @returns Each letter with its stations, in order.
 */
export const stationsByLetter = (stations: StationSummary[]): StationGroup[] => {
  const groups: StationGroup[] = [];
  const sorted = [...stations].sort((first, second) => first.name.localeCompare(second.name));
  for (const station of sorted) {
    const letter = (foldName(station.name).charAt(0) || '#').toUpperCase();
    const group = groups.at(-1);
    if (group?.letter === letter) group.stations.push(station);
    else groups.push({ letter, stations: [station] });
  }
  return groups;
};

/**
 * The piece of a line a station's view draws, in the line's order: the stop before, the station,
 * the stop after, each beside where the line goes on past it. At an end there is no stop that way,
 * and the station itself says so.
 *
 * @param direction - The stops either side on one run of the line.
 * @param here - The station.
 * @param here.id - Its id.
 * @param here.name - Its name.
 * @returns The rows, top to bottom.
 */
export const stripAround = (direction: LineDirection, here: { id: string; name: string }): StripStop[] => {
  const beside = (stop: StopToward): StripStop => ({
    id: stop.id,
    name: stop.name,
    here: false,
    note: stop.towards ? `towards ${stop.towards}` : 'end of the line',
  });
  const atEnd = !direction.previous || !direction.next;
  return [
    ...(direction.previous ? [beside(direction.previous)] : []),
    { id: here.id, name: here.name, here: true, note: atEnd ? 'end of the line' : '' },
    ...(direction.next ? [beside(direction.next)] : []),
  ];
};
