import { describe, expect, test } from 'vitest';
import { formatExplorerQuery, parseExplorerQuery } from '~/features/explorer/explorerUrl.utils';

describe('ExplorerUrlUtils', () => {
  describe('parseExplorerQuery', () => {
    test('reads a day, a view and a station', () => {
      expect(parseExplorerQuery({ date: '1935-06-01', map: '13/51.513/-0.115', station: 'aldwych' })).toEqual({
        date: Date.UTC(1935, 5, 1),
        view: { center: [-0.115, 51.513], zoom: 13 },
        station: 'aldwych',
      });
    });

    test('reads a bare year as its last day', () => {
      expect(parseExplorerQuery({ date: '1935' })).toEqual({ date: Date.UTC(1935, 11, 31) });
    });

    test('leaves out what is malformed, so a bad link opens the default', () => {
      expect(parseExplorerQuery({ date: '1999-02-31', map: '99/51/0', station: '../x' })).toEqual({});
      expect(parseExplorerQuery({ date: 'soon', map: '12/51', station: '' })).toEqual({});
    });

    test('reads a plan', () => {
      expect(parseExplorerQuery({ plan: 'general-plan' })).toEqual({ plan: 'general-plan' });
      expect(parseExplorerQuery({ plan: 'General Plan' })).toEqual({});
    });

    test('takes the first of a repeated parameter', () => {
      expect(parseExplorerQuery({ station: ['bank', 'oval'] })).toEqual({ station: 'bank' });
    });
  });

  describe('formatExplorerQuery', () => {
    test('writes only what is set, rounded for a link', () => {
      expect(formatExplorerQuery({})).toEqual({});
      expect(formatExplorerQuery({ date: Date.UTC(1935, 5, 1), view: { center: [-0.1150004, 51.5130004], zoom: 13.004 }, station: 'aldwych' })).toEqual({
        date: '1935-06-01',
        map: '13.00/51.51300/-0.11500',
        station: 'aldwych',
      });
    });

    test('round-trips through parseExplorerQuery', () => {
      const state = { date: Date.UTC(1968, 11, 1), view: { center: [-0.12, 51.5] as [number, number], zoom: 11.5 }, station: 'victoria', plan: 'extension' };
      expect(parseExplorerQuery(formatExplorerQuery(state))).toEqual(state);
    });
  });
});
