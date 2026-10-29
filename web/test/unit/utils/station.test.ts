import { describe, expect, test } from 'vitest';
import { findStations, foldName } from '../../../app/utils/station.utils';

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
});
