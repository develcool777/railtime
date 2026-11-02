import { describe, expect, test } from 'vitest';
import type { Line, Station } from '@railtime/schema/network.types';
import { toTimestamp } from '@railtime/core/date.utils';
import { gapsOf, lineWithout, runsOutside, stationOutside } from '../../../src/facts/aliases.utils';

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

/** A gap from 1950 to 1970: the years `green` ran as `blue`. */
const MIDDLE = [{ from: toTimestamp('1950-01-01'), until: toTimestamp('1970-01-01') }];

describe('AliasesUtils', () => {
  describe('gapsOf', () => {
    test('gives each line shown the years it was drawn as a line hidden, each alias from the one before it', () => {
      const lines = { green: GREEN, red: { ...GREEN, aliases: [] } };
      expect(gapsOf(lines, new Set(['red']))).toEqual(new Map([['green', [{ from: -Infinity, until: toTimestamp('1950-01-01') }]]]));
      expect(gapsOf(lines, new Set(['blue']))).toEqual(new Map([['green', MIDDLE]]));
      expect(gapsOf(lines, new Set(['green', 'blue']))).toEqual(new Map());
    });
  });

  describe('lineWithout', () => {
    test('drops its aliases to lines hidden, and keeps it as it is with none', () => {
      expect(lineWithout(GREEN, new Set(['blue'])).aliases).toEqual([GREEN.aliases![0]]);
      expect(lineWithout(GREEN, new Set(['red', 'blue']))).not.toHaveProperty('aliases');
      expect(lineWithout(GREEN, new Set(['grey']))).toBe(GREEN);
    });
  });

  describe('runsOutside', () => {
    test('tells a run with some of it outside the gaps from one all inside them', () => {
      expect(runsOutside({ open: '1940-01-01', close: '1960-01-01' }, MIDDLE)).toBe(true);
      expect(runsOutside({ open: '1955-01-01', close: '1960-01-01' }, MIDDLE)).toBe(false);
      expect(runsOutside({ open: '1955-01-01' }, MIDDLE)).toBe(true);
    });
  });

  describe('stationOutside', () => {
    test('opens it as the line is back, closes it as the line goes, cuts its spells, and leaves other lines as they are', () => {
      const station: Station = {
        name: 'C',
        coordinate: [0, 0],
        infill: { green: '1955-01-01', red: '1955-01-01' },
        closed: { green: '1965-01-01' },
        suspended: { green: [{ from: '1945-01-01', until: '1975-01-01' }], red: [{ from: '1960-01-01', until: '1961-01-01' }] },
      };
      expect(stationOutside(station, new Map([['green', MIDDLE]]))).toEqual({
        name: 'C',
        coordinate: [0, 0],
        infill: { green: '1970-01-01', red: '1955-01-01' },
        closed: { green: '1950-01-01' },
        suspended: {
          green: [
            { from: '1945-01-01', until: '1950-01-01' },
            { from: '1970-01-01', until: '1975-01-01' },
          ],
          red: [{ from: '1960-01-01', until: '1961-01-01' }],
        },
      });
      expect(stationOutside(station, new Map([['blue', MIDDLE]]))).toBe(station);
    });

    test('has a line gone from the start, closing there in its gap, pass it by', () => {
      const station: Station = { name: 'C', coordinate: [0, 0], closed: { green: '1940-01-01' } };
      expect(stationOutside(station, new Map([['green', [{ from: -Infinity, until: toTimestamp('1950-01-01') }]]]))).toEqual({
        name: 'C',
        coordinate: [0, 0],
        passes: ['green'],
      });
    });
  });
});
