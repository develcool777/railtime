import { NetworkFacts } from '@railtime/network/facts.service';
import { hiddenNetwork } from '@railtime/network/testing/hiddenNetwork';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { explorerAddressOf, formatExplorerQuery, linkedMomentOf, parseExplorerQuery, sameQuery } from '~/features/explorer/address/address.utils';

/** The tiny network's playheads, today 1 January 2026, and with its plan built. */
const { playheads } = NetworkFacts.create(tinyNetwork(), { today: Date.UTC(2026, 0, 1) });
const planned = NetworkFacts.create(tinyNetwork(), { today: Date.UTC(2026, 0, 1), plan: planId('extension') }).playheads;

/** What an address with nothing in it asks for: every setting at its default. */
const AT_DEFAULTS = parseExplorerQuery({});

describe('ExplorerUrlUtils', () => {
  describe('sameQuery', () => {
    test('compares keys and values, not their order', () => {
      expect(sameQuery({ tab: 'route', at: '12' }, { at: '12', tab: 'route' })).toBe(true);
      expect(sameQuery({ tab: 'route' }, { tab: 'route', at: '12' })).toBe(false);
      expect(sameQuery({ station: ['bank'] }, { station: 'bank' })).toBe(false);
    });
  });

  describe('parseExplorerQuery', () => {
    test('sets a page with nothing in its address as it opens', () => {
      expect(AT_DEFAULTS).toEqual({
        walk: 800,
        viewMode: '2d',
        stationNames: true,
        streetNames: true,
        trains: false,
        mapOnly: false,
        panelOpen: true,
        speed: 2,
        camera: 'follow',
        minimap: true,
      });
    });

    test('reads a moment, a view and a station', () => {
      expect(parseExplorerQuery({ at: '1935-06-01', map: '13/51.513/-0.115', station: 'aldwych' })).toEqual({
        ...AT_DEFAULTS,
        at: { day: Date.UTC(1935, 5, 1) },
        view: { center: [-0.115, 51.513], zoom: 13 },
        station: 'aldwych',
      });
    });

    test("reads how many of a day's changes are done, and the next one's progress in hundredths", () => {
      const day = Date.UTC(1935, 5, 1);
      expect(parseExplorerQuery({ at: '1935-06-01,0' }).at).toEqual({ day, partway: { done: 0, progress: 0 } });
      expect(parseExplorerQuery({ at: '1935-06-01,2.4' }).at).toEqual({ day, partway: { done: 2, progress: 0.4 } });
      expect(parseExplorerQuery({ at: '1935-06-01,0.05' }).at).toEqual({ day, partway: { done: 0, progress: 0.05 } });
    });

    test("reads a plan's changes, which have no day", () => {
      expect(parseExplorerQuery({ at: 'plan,1.5' }).at).toEqual({ day: null, partway: { done: 1, progress: 0.5 } });
      expect(parseExplorerQuery({ at: 'plan' }).at).toEqual({ day: null });
    });

    test('leaves out what is malformed, whole, so a bad link opens the default', () => {
      expect(parseExplorerQuery({ at: '1999-02-31', map: '99/51/0', station: '../x' })).toEqual(AT_DEFAULTS);
      expect(parseExplorerQuery({ at: 'soon', map: '12/51', station: '' })).toEqual(AT_DEFAULTS);
      for (const text of ['-1', '1999', '1999-01', '1999-01-01,', '1999-01-01,1.', '1999-01-01,1.234', '1999-01-01,-1', 'plan,', 'plans,1'])
        expect(parseExplorerQuery({ at: text })).toEqual(AT_DEFAULTS);
    });

    test('opens at rest on an `at` written as a cursor, which meant something to one set of facts alone', () => {
      for (const text of ['0', '202', '202.4', '202.05', '202,1928-06-01']) expect(parseExplorerQuery({ at: text })).toEqual(AT_DEFAULTS);
    });

    test('reads a plan', () => {
      expect(parseExplorerQuery({ plan: 'general-plan' }).plan).toBe('general-plan');
      expect(parseExplorerQuery({ plan: 'General Plan' })).toEqual(AT_DEFAULTS);
    });

    test("reads a route's ends, either until both are picked, and the way drawn after the fastest; and a reach's start", () => {
      expect(parseExplorerQuery({ route: 'bank,oval' }).route).toEqual({ from: 'bank', to: 'oval' });
      expect(parseExplorerQuery({ route: 'bank,oval,2' }).route).toEqual({ from: 'bank', to: 'oval', option: 2 });
      expect(parseExplorerQuery({ route: 'bank,' }).route).toEqual({ from: 'bank' });
      expect(parseExplorerQuery({ route: ',oval' }).route).toEqual({ to: 'oval' });
      expect(parseExplorerQuery({ reach: 'bank' }).reach).toBe('bank');
    });

    test('leaves out a route with no end, a malformed end or way, and a malformed reach', () => {
      expect(parseExplorerQuery({ route: ',' })).toEqual(AT_DEFAULTS);
      expect(parseExplorerQuery({ route: 'Bank!,oval,0' }).route).toEqual({ to: 'oval' });
      expect(parseExplorerQuery({ route: 'bank,oval,1.5' }).route).toEqual({ from: 'bank', to: 'oval' });
      expect(parseExplorerQuery({ reach: 'Bank!' })).toEqual(AT_DEFAULTS);
    });

    test("reads coverage's distance, one of its own, and any other as the default", () => {
      expect(parseExplorerQuery({ walk: '400' }).walk).toBe(400);
      expect(parseExplorerQuery({ walk: '1200' }).walk).toBe(1200);
      expect(parseExplorerQuery({ walk: '800' }).walk).toBe(800);
      expect(parseExplorerQuery({ walk: '500' }).walk).toBe(800);
    });

    test("reads the tab, the line open, 3D, the stations' and the streets' names hidden and map only", () => {
      expect(parseExplorerQuery({ tab: 'route', line: 'central', view: '3d', names: 'off', streets: 'off', mapOnly: '1' })).toEqual({
        ...AT_DEFAULTS,
        section: 'route',
        line: 'central',
        viewMode: '3d',
        stationNames: false,
        streetNames: false,
        mapOnly: true,
      });
    });

    test('leaves out a tab there is none of, and reads the defaults written out, and anything else, as the defaults', () => {
      expect(parseExplorerQuery({ tab: 'trains', line: 'Central Line', view: '2d', names: 'on', streets: 'on', mapOnly: 'yes' })).toEqual(AT_DEFAULTS);
    });

    test('reads trains running, and nothing else as asking for them', () => {
      expect(parseExplorerQuery({ trains: 'on' }).trains).toBe(true);
      expect(parseExplorerQuery({ trains: 'off' }).trains).toBe(false);
    });

    test('reads how playback is set, one of its own, and the panel folded', () => {
      expect(parseExplorerQuery({ speed: '4', camera: 'free', minimap: 'off', panel: 'off' })).toEqual({
        ...AT_DEFAULTS,
        speed: 4,
        camera: 'free',
        minimap: false,
        panelOpen: false,
      });
      expect(parseExplorerQuery({ speed: '0.5' }).speed).toBe(0.5);
      expect(parseExplorerQuery({ speed: '1.5' }).speed).toBe(1.5);
      expect(parseExplorerQuery({ speed: '2', camera: 'follow', minimap: 'on', panel: 'on' })).toEqual(AT_DEFAULTS);
      expect(parseExplorerQuery({ speed: '3', camera: 'drone' })).toEqual(AT_DEFAULTS);
    });

    test('takes the first of a repeated parameter', () => {
      expect(parseExplorerQuery({ station: ['bank', 'oval'] }).station).toBe('bank');
    });
  });

  describe('formatExplorerQuery', () => {
    test('writes only what is set, rounded for a link', () => {
      expect(formatExplorerQuery(AT_DEFAULTS)).toEqual({});
      expect(
        formatExplorerQuery({
          ...AT_DEFAULTS,
          at: { day: Date.UTC(1935, 5, 1) },
          view: { center: [-0.1150004, 51.5130004], zoom: 13.004 },
          station: 'aldwych',
        }),
      ).toEqual({
        at: '1935-06-01',
        map: '13.00/51.51300/-0.11500',
        station: 'aldwych',
      });
    });

    test("writes a moment's day, how many of its changes are done and the next one's progress to the hundredth, or a plan's", () => {
      const day = Date.UTC(1935, 5, 1);
      const written = (moment: NonNullable<typeof AT_DEFAULTS.at>) => formatExplorerQuery({ ...AT_DEFAULTS, at: moment }).at;
      expect(written({ day })).toBe('1935-06-01');
      expect(written({ day, partway: { done: 0, progress: 0 } })).toBe('1935-06-01,0');
      expect(written({ day, partway: { done: 2, progress: 0.4 } })).toBe('1935-06-01,2.4');
      expect(written({ day, partway: { done: 0, progress: 0.05 } })).toBe('1935-06-01,0.05');
      expect(written({ day: null, partway: { done: 1, progress: 0.25 } })).toBe('plan,1.25');
    });

    test('writes each setting by its own parameter, and none at its default', () => {
      expect(
        formatExplorerQuery({
          ...AT_DEFAULTS,
          walk: 1200,
          viewMode: '3d',
          stationNames: false,
          streetNames: false,
          trains: true,
          mapOnly: true,
          panelOpen: false,
          speed: 0.5,
          camera: 'free',
          minimap: false,
        }),
      ).toEqual({
        walk: '1200',
        view: '3d',
        names: 'off',
        streets: 'off',
        trains: 'on',
        mapOnly: '1',
        panel: 'off',
        speed: '0.5',
        camera: 'free',
        minimap: 'off',
      });
    });

    test('round-trips through parseExplorerQuery', () => {
      for (const moment of [
        { day: Date.UTC(1935, 5, 1), partway: { done: 3, progress: 0.25 } },
        { day: Date.UTC(1935, 5, 1), partway: { done: 0, progress: 0 } },
        { day: null, partway: { done: 1, progress: 0.5 } },
        { day: null },
      ])
        expect(parseExplorerQuery(formatExplorerQuery({ ...AT_DEFAULTS, at: moment })).at).toEqual(moment);
      const state = {
        at: { day: Date.UTC(1968, 11, 1) },
        view: { center: [-0.12, 51.5] as [number, number], zoom: 11.5 },
        station: 'victoria',
        plan: 'extension',
        section: 'reach' as const,
        walk: 1200 as const,
        route: { from: 'bank', to: 'oval', option: 1 },
        reach: 'oval',
        line: 'victoria',
        viewMode: '3d' as const,
        stationNames: false,
        streetNames: false,
        trains: true,
        mapOnly: true,
        panelOpen: false,
        speed: 0.5,
        camera: 'free' as const,
        minimap: false,
      };
      expect(parseExplorerQuery(formatExplorerQuery(state))).toEqual(state);
    });
  });

  describe('linkedMomentOf', () => {
    test('names none where the map rests: today, or with a plan the plan built', () => {
      expect(linkedMomentOf(playheads.today(), playheads)).toBeNull();
      expect(linkedMomentOf(planned.end(), planned)).toBeNull();
      expect(linkedMomentOf(planned.today(), planned)).toEqual({ day: planned.today().time });
    });

    test('names the day the map stands on, quiet or on a change', () => {
      const quiet = playheads.on(Date.UTC(1905, 5, 1));
      expect(linkedMomentOf(quiet, playheads)).toEqual({ day: quiet.time });
      expect(linkedMomentOf(playheads.after(2), playheads)).toEqual({ day: playheads.after(2).time });
    });

    test('names a change drawn in part by its progress, to the hundredth; drawn whole, it is done', () => {
      expect(linkedMomentOf(playheads.after(1, 0.4321), playheads)).toEqual({ day: playheads.after(1, 0.4321).time, partway: { done: 0, progress: 0.43 } });
      expect(linkedMomentOf({ ...playheads.after(1, 0.5), progress: 0.998 }, playheads)).toEqual({ day: playheads.after(2).time });
    });

    test('names a day in the years after the last change apart from today, though no change parts them', () => {
      const lastYear = playheads.on(Date.UTC(2025, 0, 1));
      expect(lastYear.cursor).toBe(playheads.today().cursor);
      expect(linkedMomentOf(lastYear, playheads)).toEqual({ day: lastYear.time });
    });

    test('names none for a plan drawn to its end, to the hundredth', () => {
      const last = planned.end().cursor - 1;
      expect(linkedMomentOf({ ...planned.after(last, 0.5), progress: 0.998 }, planned)).toBeNull();
    });

    test('takes what it names back to the same place through the address', () => {
      const places = [playheads.after(2), playheads.after(1, 0.25), playheads.on(Date.UTC(1905, 5, 1)), planned.after(planned.today().cursor + 1)];
      for (const place of places.slice(0, 3)) {
        const read = parseExplorerQuery(formatExplorerQuery({ ...AT_DEFAULTS, at: linkedMomentOf(place, playheads)! }));
        expect(playheads.atMoment(read.at!)).toEqual(place);
      }
      const inPlan = places[3]!;
      const read = parseExplorerQuery(formatExplorerQuery({ ...AT_DEFAULTS, at: linkedMomentOf(inPlan, planned)! }));
      expect(planned.atMoment(read.at!)).toEqual(inPlan);
    });

    test('stands on the same date read against other facts: a line hidden when it was written is not in the address', () => {
      const hiding = NetworkFacts.create(hiddenNetwork(), { today: Date.UTC(2026, 0, 1) }).playheads;
      const shown = NetworkFacts.create(hiddenNetwork(), { today: Date.UTC(2026, 0, 1), hidden: [] }).playheads;
      const day = Date.UTC(1975, 5, 1);
      expect(hiding.on(day).cursor).not.toBe(shown.on(day).cursor);
      expect(shown.atMoment(linkedMomentOf(hiding.on(day), hiding)!)).toEqual(shown.on(day));
    });
  });

  describe('explorerAddressOf', () => {
    const asOpened = {
      at: null,
      view: null,
      openStation: null,
      openLine: null,
      plan: undefined,
      section: 'lines' as const,
      openingSection: 'lines' as const,
      routeEnds: { from: null, to: null },
      routeOption: 0,
      reachFrom: null,
      settings: AT_DEFAULTS,
    };

    test('says nothing of what is as a page opens', () => {
      expect(formatExplorerQuery(explorerAddressOf(asOpened))).toEqual({});
    });

    test('says trains are running', () => {
      expect(formatExplorerQuery(explorerAddressOf({ ...asOpened, settings: { ...AT_DEFAULTS, trains: true } }))).toEqual({ trains: 'on' });
    });

    test('leaves the section out only where a page with that plan opens on it', () => {
      expect(explorerAddressOf({ ...asOpened, section: 'plans', openingSection: 'plans' }).section).toBeUndefined();
      expect(explorerAddressOf({ ...asOpened, section: 'plans' }).section).toBe('plans');
    });

    test('says what differs: the section, a route by its ends and way, the names hidden, 3D, playback', () => {
      expect(
        formatExplorerQuery(
          explorerAddressOf({
            ...asOpened,
            section: 'route',
            routeEnds: { from: stationId('a'), to: null },
            routeOption: 2,
            settings: { ...AT_DEFAULTS, stationNames: false, viewMode: '3d', speed: 4, camera: 'free', minimap: false },
          }),
        ),
      ).toEqual({ tab: 'route', route: 'a,,2', names: 'off', view: '3d', speed: '4', camera: 'free', minimap: 'off' });
    });
  });
});
