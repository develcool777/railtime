import { describe, expect, test } from 'vitest';
import { NetworkFacts } from '@railtime/network/facts.service';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { formatExplorerQuery, linkedPlayheadOf, parseExplorerQuery, playheadOf, sameQuery } from '~/features/explorer/address/address.utils';

/** The tiny network's playheads, today 1 January 2026, and with its plan built. */
const { playheads } = NetworkFacts.create(tinyNetwork(), { today: Date.UTC(2026, 0, 1) });
const planned = NetworkFacts.create(tinyNetwork(), { today: Date.UTC(2026, 0, 1), plan: 'extension' }).playheads;

describe('ExplorerUrlUtils', () => {
  describe('sameQuery', () => {
    test('compares keys and values, not their order', () => {
      expect(sameQuery({ tab: 'route', at: '12' }, { at: '12', tab: 'route' })).toBe(true);
      expect(sameQuery({ tab: 'route' }, { tab: 'route', at: '12' })).toBe(false);
      expect(sameQuery({ station: ['bank'] }, { station: 'bank' })).toBe(false);
    });
  });

  describe('parseExplorerQuery', () => {
    test('reads a playhead, a view and a station', () => {
      expect(parseExplorerQuery({ at: '202,1935-06-01', map: '13/51.513/-0.115', station: 'aldwych' })).toEqual({
        at: { cursor: 202, progress: 0, time: Date.UTC(1935, 5, 1) },
        view: { center: [-0.115, 51.513], zoom: 13 },
        station: 'aldwych',
      });
    });

    test("reads a playhead's changes done, and the next one's progress in hundredths", () => {
      expect(parseExplorerQuery({ at: '0' })).toEqual({ at: { cursor: 0, progress: 0 } });
      expect(parseExplorerQuery({ at: '202.4' })).toEqual({ at: { cursor: 202, progress: 0.4 } });
      expect(parseExplorerQuery({ at: '202.05' })).toEqual({ at: { cursor: 202, progress: 0.05 } });
    });

    test('leaves out what is malformed, whole, so a bad link opens the default', () => {
      expect(parseExplorerQuery({ at: '12,1999-02-31', map: '99/51/0', station: '../x' })).toEqual({});
      expect(parseExplorerQuery({ at: 'soon', map: '12/51', station: '' })).toEqual({});
      for (const text of ['-1', '12.', '12.345', '12.4,1999-01-01', '12,1999', '1e3']) expect(parseExplorerQuery({ at: text })).toEqual({});
    });

    test('reads a plan', () => {
      expect(parseExplorerQuery({ plan: 'general-plan' })).toEqual({ plan: 'general-plan' });
      expect(parseExplorerQuery({ plan: 'General Plan' })).toEqual({});
    });

    test("reads coverage's distance, one of its own but the default", () => {
      expect(parseExplorerQuery({ walk: '400' })).toEqual({ walk: 400 });
      expect(parseExplorerQuery({ walk: '1200' })).toEqual({ walk: 1200 });
      expect(parseExplorerQuery({ walk: '800' })).toEqual({});
      expect(parseExplorerQuery({ walk: '500' })).toEqual({});
    });

    test("reads the tab, the line open, 3D, the stations' and the streets' names hidden and map only", () => {
      expect(parseExplorerQuery({ tab: 'route', line: 'central', view: '3d', names: 'off', streets: 'off', mapOnly: '1' })).toEqual({
        section: 'route',
        line: 'central',
        viewMode: '3d',
        stationNames: false,
        streetNames: false,
        mapOnly: true,
      });
    });

    test('leaves out a tab there is none of, and the defaults written out', () => {
      expect(parseExplorerQuery({ tab: 'trains', line: 'Central Line', view: '2d', names: 'on', streets: 'on', mapOnly: 'yes' })).toEqual({});
    });

    test('takes the first of a repeated parameter', () => {
      expect(parseExplorerQuery({ station: ['bank', 'oval'] })).toEqual({ station: 'bank' });
    });
  });

  describe('formatExplorerQuery', () => {
    test('writes only what is set, rounded for a link', () => {
      expect(formatExplorerQuery({})).toEqual({});
      expect(
        formatExplorerQuery({
          at: { cursor: 12, progress: 0, time: Date.UTC(1935, 5, 1) },
          view: { center: [-0.1150004, 51.5130004], zoom: 13.004 },
          station: 'aldwych',
        }),
      ).toEqual({
        at: '12,1935-06-01',
        map: '13.00/51.51300/-0.11500',
        station: 'aldwych',
      });
    });

    test("writes a playhead's changes done, the next one's progress to the hundredth, or its day", () => {
      expect(formatExplorerQuery({ at: { cursor: 202, progress: 0 } })).toEqual({ at: '202' });
      expect(formatExplorerQuery({ at: { cursor: 202, progress: 0.4 } })).toEqual({ at: '202.4' });
      expect(formatExplorerQuery({ at: { cursor: 202, progress: 0.05 } })).toEqual({ at: '202.05' });
    });

    test('round-trips through parseExplorerQuery', () => {
      for (const linked of [
        { cursor: 3, progress: 0.25 },
        { cursor: 0, progress: 0 },
      ])
        expect(parseExplorerQuery(formatExplorerQuery({ at: linked }))).toEqual({ at: linked });
      const state = {
        at: { cursor: 202, progress: 0, time: Date.UTC(1968, 11, 1) },
        view: { center: [-0.12, 51.5] as [number, number], zoom: 11.5 },
        station: 'victoria',
        plan: 'extension',
        section: 'reach' as const,
        walk: 1200 as const,
        line: 'victoria',
        viewMode: '3d' as const,
        stationNames: false as const,
        streetNames: false as const,
        mapOnly: true as const,
      };
      expect(parseExplorerQuery(formatExplorerQuery(state))).toEqual(state);
    });
  });

  describe('linkedPlayheadOf', () => {
    test('names none where the map rests: today, or with a plan the plan built', () => {
      expect(linkedPlayheadOf(playheads.today(), playheads)).toBeNull();
      expect(linkedPlayheadOf(planned.end(), planned)).toBeNull();
      expect(linkedPlayheadOf(planned.today(), planned)).toEqual({ cursor: planned.today().cursor, progress: 0, time: planned.today().time });
    });

    test('names the changes done, and the day only where they do not imply it', () => {
      const quiet = playheads.on(Date.UTC(1905, 5, 1));
      expect(linkedPlayheadOf(playheads.after(2), playheads)).toEqual({ cursor: 2, progress: 0 });
      expect(linkedPlayheadOf(quiet, playheads)).toEqual({ cursor: 1, progress: 0, time: quiet.time });
    });

    test('names a change drawn in part by its progress, to the hundredth, never its day; drawn whole, it is done', () => {
      expect(linkedPlayheadOf(playheads.after(1, 0.4321), playheads)).toEqual({ cursor: 1, progress: 0.43 });
      expect(linkedPlayheadOf({ ...playheads.after(1, 0.5), progress: 0.998 }, playheads)).toEqual({ cursor: 2, progress: 0 });
    });

    test('names a day in the years after the last change apart from today, though no change parts them', () => {
      const lastYear = playheads.on(Date.UTC(2025, 0, 1));
      expect(lastYear.cursor).toBe(playheads.today().cursor);
      expect(linkedPlayheadOf(lastYear, playheads)).toEqual({ cursor: lastYear.cursor, progress: 0, time: lastYear.time });
    });
  });

  describe('playheadOf', () => {
    test('gives a named playhead its time: the one implied, or the day it names', () => {
      expect(playheadOf({ cursor: 2, progress: 0 }, playheads)).toEqual(playheads.after(2));
      expect(playheadOf({ cursor: 1, progress: 0.4 }, playheads)).toEqual(playheads.after(1, 0.4));
      expect(playheadOf({ cursor: 1, progress: 0, time: Date.UTC(1905, 5, 1) }, playheads)).toEqual(playheads.on(Date.UTC(1905, 5, 1)));
    });

    test('round-trips with linkedPlayheadOf', () => {
      for (const playhead of [playheads.after(2), playheads.after(1, 0.25), playheads.on(Date.UTC(1905, 5, 1)), planned.after(planned.today().cursor + 1)]) {
        const linked = linkedPlayheadOf(playhead, planned);
        expect(linked && playheadOf(linked, planned)).toEqual(playhead);
      }
    });
  });
});
