import type { LineDetails, StationSummary } from '@railtime/renderer/transitMap.types';

import type { LineDirection, StationGroup, StopToward } from '~/features/explorer/stations/station.types';

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
 * The stop one before and one after a station on a line, each with the end of the line that way,
 * as a platform's sign gives them: once for each run it is on, so a junction has a pair for each
 * branch. A branch's first stop is the station it leaves from, so from there a branch goes one way.
 *
 * @param station - The station's id.
 * @param line - The line on the date shown, with its stops.
 * @returns Each pair, in the line's order; none where the line does not call.
 */
export const directionsAt = (station: string, line: LineDetails): LineDirection[] => {
  const found: LineDirection[] = [];
  const toward = (stop: { id: string; name: string } | undefined, end: { name: string } | undefined): StopToward | null =>
    stop ? { id: stop.id, name: stop.name, towards: end && end.name !== stop.name ? end.name : null } : null;
  for (const run of line.branches) {
    run.forEach((stop, place) => {
      if (stop.id !== station) return;
      const direction = { previous: toward(run[place - 1], run[0]), next: toward(run[place + 1], run.at(-1)) };
      const known = found.some(entry => entry.previous?.id === direction.previous?.id && entry.next?.id === direction.next?.id);
      if ((direction.previous || direction.next) && !known) found.push(direction);
    });
  }
  return found;
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
