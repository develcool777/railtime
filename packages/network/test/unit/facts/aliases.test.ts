import { describe, expect, test } from 'vitest';
import type { Line, Station } from '@railtime/schema/network.types';
import { lineFrom, runFrom, shownFromOf, stationFrom } from '../../../src/facts/aliases.utils';

/** A line drawn as `red` until 1950, then as `blue` until 1970. */
const GREEN: Line = {
  name: 'Green',
  network: 'metro',
  mode: 'metro',
  color: '#00aa00',
  aliases: [
    { until: '1950-01-01', as: 'red', text: 'Green runs as Blue' },
    { until: '1970-01-01', as: 'blue', text: 'Green becomes its own line' },
  ],
};

describe('AliasesUtils', () => {
  describe('shownFromOf', () => {
    test('gives each line shown the day its last alias to a line hidden ends', () => {
      const lines = { green: GREEN, red: { ...GREEN, aliases: [] } };
      expect(shownFromOf(lines, new Set(['red']))).toEqual(new Map([['green', '1950-01-01']]));
      expect(shownFromOf(lines, new Set(['red', 'blue']))).toEqual(new Map([['green', '1970-01-01']]));
      expect(shownFromOf(lines, new Set(['green', 'blue']))).toEqual(new Map());
    });
  });

  describe('lineFrom', () => {
    test('keeps the aliases ending after the day, and none once all have', () => {
      expect(lineFrom(GREEN, '1950-01-01').aliases).toEqual([GREEN.aliases![1]]);
      expect(lineFrom(GREEN, '1970-01-01')).not.toHaveProperty('aliases');
    });
  });

  describe('runFrom', () => {
    test('opens a run then at the earliest, trims its spells, and drops one closed by then', () => {
      const run = {
        open: '1900-01-01',
        close: '1990-01-01',
        suspended: [
          { from: '1910-01-01', until: '1920-01-01' },
          { from: '1940-01-01', until: '1960-01-01' },
        ],
      };
      expect(runFrom(run, '1950-01-01')).toEqual({ open: '1950-01-01', close: '1990-01-01', suspended: [{ from: '1950-01-01', until: '1960-01-01' }] });
      expect(runFrom({ open: '1960-01-01' }, '1950-01-01')).toEqual({ open: '1960-01-01' });
      expect(runFrom(run, '1990-01-01')).toBeNull();
    });
  });

  describe('stationFrom', () => {
    test("opens it with the line before the day, passes it by where it had closed by then, and leaves other lines' as they are", () => {
      const station: Station = {
        name: 'C',
        coordinate: [0, 0],
        infill: { green: '1940-01-01', red: '1940-01-01' },
        closed: { green: '1945-01-01' },
        suspended: { green: [{ from: '1930-01-01', until: '1935-01-01' }], red: [{ from: '1930-01-01', until: '1935-01-01' }] },
      };
      expect(stationFrom(station, new Map([['green', '1950-01-01']]))).toEqual({
        name: 'C',
        coordinate: [0, 0],
        infill: { red: '1940-01-01' },
        suspended: { red: [{ from: '1930-01-01', until: '1935-01-01' }] },
        passes: ['green'],
      });
      expect(stationFrom(station, new Map([['green', '1920-01-01']]))).toEqual(station);
    });
  });
});
