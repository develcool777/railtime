import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { standInMap } from '@test/support/factories/transitMap.utils';
import { describe, expect, test } from 'vitest';

import type { PanelView } from '~/features/explorer/explorer.types';
import { useNetworkStore } from '~/features/explorer/network.store';
import { useTimeStore } from '~/features/explorer/time/time.store';
import { useToolsStore } from '~/features/explorer/tools.store';
import { chromeOf, openingSectionOf, openOf, railSectionOf, walkedTo, withoutStations, withStation } from '~/features/explorer/explorer.utils';

const line = (id: string): PanelView => ({ kind: 'line', id });
const station = (id: string): PanelView => ({ kind: 'station', id });

describe('ExplorerUtils', () => {
  describe('withStation', () => {
    test('opens a station over the line open, in place of any walk', () => {
      expect(withStation([], 'bank')).toEqual([station('bank')]);
      expect(withStation([line('central')], 'bank')).toEqual([line('central'), station('bank')]);
      expect(withStation([line('central'), station('bank'), station('oval')], 'angel')).toEqual([line('central'), station('angel')]);
    });
  });

  describe('walkedTo', () => {
    test('walks on from the station open, so Back returns to it', () => {
      expect(walkedTo([line('central'), station('bank')], 'oval')).toEqual([line('central'), station('bank'), station('oval')]);
    });

    test('stays put for the station open, or with no station open', () => {
      const views = [station('bank')];
      expect(walkedTo(views, 'bank')).toBe(views);
      expect(walkedTo([line('central')], 'bank')).toEqual([line('central')]);
    });
  });

  describe('withoutStations', () => {
    test('closes the stations, back to the line under them', () => {
      expect(withoutStations([line('central'), station('bank'), station('oval')])).toEqual([line('central')]);
      expect(withoutStations([station('bank')])).toEqual([]);
    });
  });

  describe('openOf', () => {
    test('finds the station open and the line under it', () => {
      const views = [line('central'), station('bank'), station('oval')];
      expect(openOf(views, 'station')).toBe('oval');
      expect(openOf(views, 'line')).toBe('central');
      expect(openOf([], 'line')).toBeNull();
    });
  });

  describe('railSectionOf', () => {
    test('marks the section a pushed view belongs to, else the one open', () => {
      expect(railSectionOf('route', [])).toBe('route');
      expect(railSectionOf('route', [line('central')])).toBe('lines');
      expect(railSectionOf('route', [line('central'), station('bank')])).toBe('stations');
    });
  });

  describe('chromeOf', () => {
    const desk = { phone: false, mapOnly: false, sheet: 'peek' as const, timeMode: 'timeline' as const, minimap: true };

    test('shows it all beside the map, the minimap only while playing', () => {
      expect(chromeOf(desk)).toEqual({ header: true, rail: true, panel: true, tools: true, timeControl: true, minimap: false, credits: 'line' });
      expect(chromeOf({ ...desk, timeMode: 'playing' }).minimap).toBe(true);
      expect(chromeOf({ ...desk, timeMode: 'playing', minimap: false }).minimap).toBe(false);
    });

    test('in map only hides everything but the credits beside the map', () => {
      expect(chromeOf({ ...desk, mapOnly: true, timeMode: 'playing' })).toEqual({
        header: false,
        rail: false,
        panel: false,
        tools: false,
        timeControl: false,
        minimap: false,
        credits: 'line',
      });
      expect(chromeOf({ ...desk, phone: true, mapOnly: true }).credits).toBeNull();
    });

    test('on a phone: no rail or minimap, the credits a button, the time control under a full sheet', () => {
      const phone = chromeOf({ ...desk, phone: true, timeMode: 'playing' });
      expect(phone).toMatchObject({ rail: false, minimap: false, credits: 'button', timeControl: true });
      expect(chromeOf({ ...desk, phone: true, sheet: 'full' }).timeControl).toBe(false);
    });
  });

  describe('openingSectionOf', () => {
    test('opens on Plans with a plan shown, else on Lines', () => {
      expect(openingSectionOf('extension')).toBe('plans');
      expect(openingSectionOf(undefined)).toBe('lines');
    });
  });
});

describe('ExplorerStore', () => {
  test('opens on what the address says, leaving out a line or station the network has not', () => {
    const explorer = openExplorer({ tab: 'stations', line: 'red', station: 'nowhere', names: 'off', view: '3d' });
    expect(explorer.section).toBe('stations');
    expect(explorer.views).toEqual([line('red')]);
    expect(explorer.stationNames).toBe(false);
    expect(explorer.viewMode).toBe('3d');
  });

  test('opens on Plans with a plan, on Lines without, and leaves the section it opens on out of the address', () => {
    expect(openExplorer({ plan: 'extension' }).section).toBe('plans');
    const explorer = openExplorer();
    expect(explorer.section).toBe('lines');
    expect(explorer.address.tab).toBeUndefined();
    explorer.OPEN_SECTION('stations');
    expect(explorer.address.tab).toBe('stations');
  });

  test('writes in the address what a link needs, from every store, and nothing that is as a page opens', () => {
    const explorer = openExplorer({ route: 'a,c', walk: '400', speed: '4' });
    explorer.PICK_STATION('b');
    expect(explorer.address).toEqual({ station: 'b', route: 'a,c', walk: '400', speed: '4' });
    expect(openExplorer().address).toEqual({});
  });

  test("picks a station clicked on the map as the route's end with Route in sight, else opens it", () => {
    const explorer = openExplorer({ tab: 'route' });
    useTimeStore().SET_TIME(timeAt({}));
    explorer.CLICK_STATION('a');
    expect(useToolsStore().routeEnds.from?.id).toBe('a');
    expect(explorer.views).toEqual([]);
    explorer.OPEN_SECTION('lines');
    explorer.CLICK_STATION('a');
    expect(explorer.views).toEqual([station('a')]);
    explorer.CLICK_STATION(null);
    expect(explorer.views).toEqual([]);
  });

  test('hides lines on the day shown: the map, made again at its today, is taken back to it', async () => {
    const explorer = openExplorer({ line: 'blue' });
    const { map, commands } = standInMap();
    explorer.ATTACH(map);
    const day = Date.UTC(1935, 0, 1);
    useTimeStore().SET_TIME(timeAt({ time: day, atToday: false, atRest: false }));
    await explorer.SHOW_LINES(['blue'], false);
    expect(useNetworkStore().hidden).toEqual(['blue']);
    // The line hidden is gone from what is open.
    expect(explorer.views).toEqual([]);
    expect(commands).toEqual([{ name: 'seek', args: [useNetworkStore().facts?.playheads.on(day)] }]);
  });

  test('shows another plan with it built, back on the timeline', async () => {
    const explorer = openExplorer();
    const { map, commands } = standInMap();
    explorer.ATTACH(map);
    useTimeStore().PLAY();
    await explorer.SHOW_PLAN('extension');
    expect(useTimeStore().playerShown).toBe(false);
    expect(commands.at(-1)).toEqual({ name: 'seek', args: [useNetworkStore().facts?.playheads.end()] });
  });

  test("wants the city's outline once Coverage is open, as the page opens or later", () => {
    openExplorer();
    expect(useToolsStore().boundaryState).toBe('idle');
    openExplorer({ tab: 'coverage' });
    expect(useToolsStore().boundaryState).toBe('loading');
    const explorer = openExplorer();
    explorer.PICK_SECTION('coverage');
    expect(useToolsStore().boundaryState).toBe('loading');
  });

  test("folds the panel with the open section's own icon beside the map; on a phone it opens it", () => {
    const explorer = openExplorer();
    explorer.PICK_SECTION('lines');
    expect(explorer.panelOpen).toBe(false);
    explorer.SET_SCREEN({ phone: true, tabLabels: false });
    explorer.PICK_SECTION('lines');
    expect(explorer.sheet).toBe('half');
  });

  test('opens one dialog at a time, closing only its own', () => {
    const explorer = openExplorer();
    const search = explorer.dialogOpen('search');
    const help = explorer.dialogOpen('help');
    search.value = true;
    help.value = true;
    expect(explorer.dialog).toBe('help');
    search.value = false;
    expect(explorer.dialog).toBe('help');
    explorer.SET_MAP_ONLY(true);
    expect(explorer.dialog).toBeNull();
  });
});
