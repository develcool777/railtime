import { describe, expect, test } from 'vitest';
import type { LineDetails } from '@railtime/renderer/transitMap.types';
import { directionsAt, findStations, foldName, stationsByLetter } from '~/features/explorer/stations/station.utils';

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

  describe('directionsAt', () => {
    /**
     * A line on the date shown, with its runs of stops; a stop's name is its id in capitals.
     *
     * @param branches - Its runs, each a list of station ids.
     * @returns The line.
     */
    const line = (branches: string[][]): LineDetails => ({
      id: 'red',
      name: 'Red',
      network: 'metro',
      networkName: 'Metro',
      color: '#ff0000',
      opened: 0,
      stations: 0,
      km: 0,
      branches: branches.map(run => run.map(stop => ({ id: stop, name: stop.toUpperCase() }))),
      changes: [],
    });

    test('gives the stop either side, each with the end of the line that way', () => {
      expect(directionsAt('c', line([['a', 'b', 'c', 'd', 'e']]))).toEqual([
        { previous: { id: 'b', name: 'B', towards: 'A' }, next: { id: 'd', name: 'D', towards: 'E' } },
      ]);
    });

    test('says no "towards" for a stop that is the end', () => {
      expect(directionsAt('b', line([['a', 'b', 'c']]))).toEqual([
        { previous: { id: 'a', name: 'A', towards: null }, next: { id: 'c', name: 'C', towards: null } },
      ]);
    });

    test('at an end, goes one way', () => {
      expect(directionsAt('a', line([['a', 'b', 'c']]))).toEqual([{ previous: null, next: { id: 'b', name: 'B', towards: 'C' } }]);
    });

    test('at a junction, gives a pair for the branch too', () => {
      const found = directionsAt(
        'b',
        line([
          ['a', 'b', 'c'],
          ['b', 'x', 'y'],
        ]),
      );
      expect(found).toEqual([
        { previous: { id: 'a', name: 'A', towards: null }, next: { id: 'c', name: 'C', towards: null } },
        { previous: null, next: { id: 'x', name: 'X', towards: 'Y' } },
      ]);
    });

    test('gives nothing where the line does not call', () => {
      expect(directionsAt('z', line([['a', 'b']]))).toEqual([]);
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
});
