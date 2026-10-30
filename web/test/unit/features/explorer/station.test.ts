import { describe, expect, test } from 'vitest';
import type { LineDetails } from '@railtime/renderer/transitMap.types';
import { findStations, foldName, nextStations } from '~/features/explorer/station.utils';

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

  describe('nextStations', () => {
    /**
     * A line on the date shown, with its runs of stops.
     *
     * @param id - Its id, which is its name too.
     * @param branches - Its runs, each a list of station ids.
     * @returns The line.
     */
    const line = (id: string, branches: string[][]): LineDetails => ({
      id,
      name: id,
      network: 'metro',
      networkName: 'Metro',
      color: `#${id}`,
      opened: 0,
      stations: 0,
      km: 0,
      branches: branches.map(run => run.map(stop => ({ id: stop, name: stop.toUpperCase() }))),
      changes: [],
    });

    test('lists each stop either side once, with every line that runs there', () => {
      const found = nextStations('b', [line('red', [['a', 'b', 'c']]), line('blue', [['c', 'b', 'd']])]);
      expect(found).toEqual([
        { id: 'a', name: 'A', lines: [{ id: 'red', name: 'red', color: '#red' }] },
        {
          id: 'c',
          name: 'C',
          lines: [
            { id: 'red', name: 'red', color: '#red' },
            { id: 'blue', name: 'blue', color: '#blue' },
          ],
        },
        { id: 'd', name: 'D', lines: [{ id: 'blue', name: 'blue', color: '#blue' }] },
      ]);
    });

    test('counts the first stop of a branch from the station it leaves', () => {
      const found = nextStations('b', [
        line('red', [
          ['a', 'b', 'c'],
          ['b', 'x'],
        ]),
      ]);
      expect(found.map(next => next.id)).toEqual(['a', 'c', 'x']);
    });
  });
});
