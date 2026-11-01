import { describe, expect, test } from 'vitest';
import type { LineInfo, OptionalNetworkInfo } from '@railtime/network/facts.types';
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
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  network,
  networkName: network.charAt(0).toUpperCase() + network.slice(1),
  color: RED,
  opened,
});

/**
 * An optional network with one line.
 *
 * @param shown - Whether it is on.
 * @returns The network.
 */
const railOf = (shown: boolean): OptionalNetworkInfo => ({ id: 'rail', name: 'Rail', shown, lines: [{ id: 'grey', name: 'Grey', color: RED }] });

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
    test('groups the lines by network in order, a plan’s own under Planned', () => {
      const groups = lineGroups([lineOf('red', 'metro'), lineOf('tram', 'trams'), lineOf('blue', 'metro'), lineOf('new', 'metro', null)], [], '');
      expect(groups.map(group => [group.name, group.lines.map(line => line.id)])).toEqual([
        ['Metro', ['red', 'blue']],
        ['Trams', ['tram']],
        ['Planned', ['new']],
      ]);
      expect(groups.every(group => group.shown && !group.optional)).toBe(true);
    });

    test('lists an optional network off after the city’s own, its lines only named', () => {
      const groups = lineGroups([lineOf('red', 'metro')], [railOf(false)], '');
      expect(groups.at(-1)).toEqual({
        network: 'rail',
        name: 'Rail',
        optional: true,
        shown: false,
        lines: [],
        offLines: [{ id: 'grey', name: 'Grey', color: RED }],
      });
    });

    test('lists an optional network on with its lines on the map, as the city’s own', () => {
      const groups = lineGroups([lineOf('red', 'metro'), lineOf('grey', 'rail')], [railOf(true)], '');
      expect(groups.at(-1)).toMatchObject({ network: 'rail', optional: true, shown: true, offLines: [] });
      expect(groups.at(-1)?.lines.map(line => line.id)).toEqual(['grey']);
    });

    test('keeps the lines a search finds, on the map or off, and the groups with any', () => {
      expect(lineGroups([lineOf('red', 'metro')], [railOf(false)], 'gre').map(group => group.network)).toEqual(['rail']);
      expect(lineGroups([lineOf('red', 'metro')], [railOf(false)], 'red').map(group => group.network)).toEqual(['metro']);
    });
  });
});
