import { describe, expect, test } from 'vitest';
import { findStations, foldName, stationsByLetter, stripAround } from '~/features/explorer/stations/station.utils';

/**
 * A station as the map lists it, red.
 *
 * @param name - Its English name.
 * @param otherNames - Its names in other languages.
 * @returns The station.
 */
const station = (name: string, otherNames: string[] = []) => ({ id: foldName(name).replaceAll(' ', '-'), name, otherNames, colors: ['#ff0000'] });

const STATIONS = [
  station("King's Cross St. Pancras"),
  station('Dalston Kingsland'),
  station('Náměstí Míru'),
  station('Khreshchatyk', ['Хрещатик']),
  station('Oxford Circus'),
  station('Circus Road'),
];

describe('StationUtils', () => {
  describe('foldName', () => {
    test('drops case, accents and apostrophes', () => {
      expect(foldName("  King's Cross St. Pancras ")).toBe('kings cross st pancras');
      expect(foldName('Náměstí Míru')).toBe('namesti miru');
    });
  });

  describe('findStations', () => {
    test('finds a station by any of its names, written loosely', () => {
      expect(findStations(STATIONS, 'kings cross', 5).map(found => found.name)).toEqual(["King's Cross St. Pancras"]);
      expect(findStations(STATIONS, 'kings', 5).map(found => found.name)).toEqual(["King's Cross St. Pancras", 'Dalston Kingsland']);
      expect(findStations(STATIONS, 'namesti', 5).map(found => found.name)).toEqual(['Náměstí Míru']);
      expect(findStations(STATIONS, 'хрещ', 5).map(found => found.name)).toEqual(['Khreshchatyk']);
    });

    test('puts names that begin with the query first, then a word of it, then the rest', () => {
      expect(findStations(STATIONS, 'circus', 5).map(found => found.name)).toEqual(['Circus Road', 'Oxford Circus']);
      expect(findStations(STATIONS, 'ircu', 5).map(found => found.name)).toEqual(['Circus Road', 'Oxford Circus']);
    });

    test('finds nothing for an empty query, and no more than asked', () => {
      expect(findStations(STATIONS, '  ', 5)).toEqual([]);
      expect(findStations(STATIONS, 'c', 2)).toHaveLength(2);
    });
  });

  describe('stationsByLetter', () => {
    test('puts the stations A to Z under their first letter, accents dropped', () => {
      const groups = stationsByLetter(STATIONS);
      expect(groups.map(group => [group.letter, group.stations.map(found => found.name)])).toEqual([
        ['C', ['Circus Road']],
        ['D', ['Dalston Kingsland']],
        ['K', ['Khreshchatyk', "King's Cross St. Pancras"]],
        ['N', ['Náměstí Míru']],
        ['O', ['Oxford Circus']],
      ]);
    });
  });
  describe('stripAround', () => {
    const HERE = { id: 'c', name: 'C' };

    test('puts the station between the stops either side, each saying where the line goes on', () => {
      const rows = stripAround({ previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: null } }, HERE);
      expect(rows).toEqual([
        { id: 'b', name: 'B', here: false, note: 'towards A' },
        { id: 'c', name: 'C', here: true, note: '' },
        { id: 'd', name: 'D', here: false, note: 'end of the line' },
      ]);
    });

    test('at an end, the station says so, with no stop that way', () => {
      const rows = stripAround({ previous: null, next: { id: 'd', name: 'D', towards: 'E' } }, HERE);
      expect(rows.map(row => [row.name, row.note])).toEqual([
        ['C', 'end of the line'],
        ['D', 'towards E'],
      ]);
    });
  });
});
