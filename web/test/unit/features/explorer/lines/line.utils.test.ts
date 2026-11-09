import type { LineInfo, NetworkChoice } from '@railtime/network/facts.types';
import { lineId, networkId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { lineGroups, titleInLine } from '~/features/explorer/lines/line.utils';

const RED = { light: '#ff0000', dark: '#ff0000' };

/**
 * A line on the map.
 *
 * @param id - Its id, and its name capitalised.
 * @param network - Its network's id, and its name capitalised.
 * @param opened - When it opened; `null` for a plan's.
 * @returns The line.
 */
const lineOf = (id: string, network: string, opened: number | null = 0): LineInfo => ({
  id: lineId(id),
  name: id.charAt(0).toUpperCase() + id.slice(1),
  network: networkId(network),
  networkName: network.charAt(0).toUpperCase() + network.slice(1),
  color: RED,
  opened,
});

/**
 * A network with a line or two that may be shown or hidden.
 *
 * @param id - Its id, and its name capitalised.
 * @param lines - Each line's id, and whether it shows.
 * @returns The network.
 */
const choiceOf = (id: string, lines: [string, boolean][]): NetworkChoice => ({
  id: networkId(id),
  name: id.charAt(0).toUpperCase() + id.slice(1),
  lines: lines.map(([line, shown]) => ({ id: lineId(line), name: line.charAt(0).toUpperCase() + line.slice(1), color: RED, shown })),
});

/** The networks the lines below are in, every line shown. */
const CHOICES = [
  choiceOf('metro', [
    ['red', true],
    ['blue', true],
  ]),
  choiceOf('trams', [['tram', true]]),
];

describe('LineUtils', () => {
  describe('titleInLine', () => {
    test('drops the line’s name, with " line" after it or not', () => {
      expect(titleInLine('Red line extended', 'Red')).toBe('Extended');
      expect(titleInLine('Red opens', 'Red')).toBe('Opens');
    });

    test('drops it before a colon', () => {
      expect(titleInLine('Red line: section closes', 'Red')).toBe('Section closes');
    });

    test('reads a name with signs in it as written', () => {
      expect(titleInLine('Hammersmith & City (east) line extended', 'Hammersmith & City (east)')).toBe('Extended');
    });

    test('leaves a title about something else as it is', () => {
      expect(titleInLine('Baker Street opens', 'Red')).toBe('Baker Street opens');
      expect(titleInLine('Redbridge opens', 'Red')).toBe('Redbridge opens');
    });
  });

  describe('lineGroups', () => {
    test('groups the lines by network in the network’s order, a plan’s own last under Planned, which no eye hides', () => {
      const groups = lineGroups([lineOf('red', 'metro'), lineOf('tram', 'trams'), lineOf('blue', 'metro'), lineOf('new', 'metro', null)], CHOICES, '');
      expect(groups.map(group => [group.name, group.entries.map(entry => entry.id), group.toggleable])).toEqual([
        ['Metro', ['red', 'blue'], ['red', 'blue']],
        ['Trams', ['tram'], ['tram']],
        ['Planned', ['new'], []],
      ]);
    });

    test('keeps a line hidden in its place, only named, and a network all hidden in its own', () => {
      const choices = [
        choiceOf('metro', [
          ['red', false],
          ['blue', true],
        ]),
        choiceOf('rail', [['grey', false]]),
        choiceOf('trams', [['tram', true]]),
      ];
      const groups = lineGroups([lineOf('blue', 'metro'), lineOf('tram', 'trams')], choices, '');
      expect(groups.map(group => [group.network, group.entries.map(entry => [entry.id, entry.shown?.id ?? null])])).toEqual([
        [
          'metro',
          [
            ['red', null],
            ['blue', 'blue'],
          ],
        ],
        ['rail', [['grey', null]]],
        ['trams', [['tram', 'tram']]],
      ]);
      expect(groups[1]).toEqual({ network: 'rail', name: 'Rail', entries: [{ id: 'grey', name: 'Grey', color: RED, shown: null }], toggleable: ['grey'] });
    });

    test('keeps the lines a search finds, on the map or hidden, and the groups with any', () => {
      const choices = [choiceOf('metro', [['red', true]]), choiceOf('rail', [['grey', false]])];
      expect(lineGroups([lineOf('red', 'metro')], choices, 'gre').map(group => group.network)).toEqual(['rail']);
      expect(lineGroups([lineOf('red', 'metro')], choices, 'red').map(group => group.network)).toEqual(['metro']);
    });
  });
});
