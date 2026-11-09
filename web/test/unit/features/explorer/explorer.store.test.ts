import { required } from '@railtime/core/required.utils';
import { hiddenNetwork } from '@railtime/network/testing/hiddenNetwork';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { mapOnStandIn } from '@test/support/factories/transitMap.utils';
import type { ExplorerQuery } from '~/features/explorer/address/address.types';
import type { PanelView } from '~/features/explorer/explorer.types';
import { useLayoutStore } from '~/features/explorer/layout.store';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useNetworkStore } from '~/features/explorer/network.store';
import { useTimeStore } from '~/features/explorer/time/time.store';
import { useToolsStore } from '~/features/explorer/tools.store';

const line = (id: string): PanelView => ({ kind: 'line', id: lineId(id) });
const station = (id: string): PanelView => ({ kind: 'station', id: stationId(id) });

describe('ExplorerStore', () => {
  test('opens on what the address says, leaving out a line or station the network has not', () => {
    const explorer = openExplorer({ tab: 'stations', line: 'red', station: 'nowhere', names: 'off', view: '3d' });
    expect(explorer.section).toBe('stations');
    expect(explorer.views).toEqual([line('red')]);
    expect(explorer.stationNames).toBe(false);
    expect(explorer.viewMode).toBe('3d');
  });

  test('runs no trains until asked, keeps them in the address, and takes them off the map while history plays', () => {
    const explorer = openExplorer();
    expect(explorer.mapProps?.trains).toBe(false);
    explorer.SET_TRAINS(true);
    expect(explorer.mapProps?.trains).toBe(true);
    expect(explorer.address.trains).toBe('on');
    useTimeStore().SET_TIME(timeAt({ playing: true }));
    expect(explorer.mapProps?.trains).toBe(false);
    expect(explorer.trains).toBe(true);
    expect(openExplorer({ trains: 'on' }).trains).toBe(true);
  });

  test('opens on Plans with a plan, on Lines without, and leaves the section it opens on out of the address', () => {
    expect(openExplorer({ plan: 'extension' }).section).toBe('plans');
    const explorer = openExplorer();
    expect(explorer.section).toBe('lines');
    expect(explorer.address.tab).toBeUndefined();
    explorer.OPEN_SECTION('stations');
    expect(explorer.address.tab).toBe('stations');
  });

  test('keeps the tab of a section left open as another plan changes the one a page opens on', () => {
    const onPlan = openExplorer({ plan: 'extension' });
    expect(onPlan.address.tab).toBeUndefined();
    onPlan.SHOW_PLAN(undefined);
    expect(onPlan.section).toBe('plans');
    expect(onPlan.address.tab).toBe('plans');
    const built = openExplorer({ tab: 'plans' });
    expect(built.address.tab).toBe('plans');
    built.SHOW_PLAN(planId('extension'));
    expect(built.address.tab).toBeUndefined();
    expect(built.address.plan).toBe('extension');
  });

  test('keeps by its id a station a link names on a line hidden at first, drawn once the line shows, and drops one the city has not', () => {
    const explorer = openExplorer({ route: 'a,x', reach: 'x' }, hiddenNetwork());
    const tools = useToolsStore();
    expect(tools.routeEnds).toEqual({ from: 'a', to: 'x' });
    expect(tools.routeEndsShown).toEqual({ from: 'a', to: null });
    expect(tools.reachFromShown).toBeNull();
    expect(explorer.address).toMatchObject({ route: 'a,x', reach: 'x' });
    explorer.SHOW_LINES([lineId('grey')], true);
    expect(tools.routeEndsShown).toEqual({ from: 'a', to: 'x' });
    expect(tools.reachFromShown).toBe('x');

    openExplorer({ route: 'a,nowhere' }, hiddenNetwork());
    expect(useToolsStore().routeEnds).toEqual({ from: 'a', to: null });
  });

  test('opens on what a network hides at first, its counts and the map without it', () => {
    const explorer = openExplorer({}, hiddenNetwork());
    expect(useNetworkStore().hidden).toEqual(['grey']);
    expect(explorer.mapProps?.facts.hidden).toEqual(['grey']);
  });

  test('writes in the address what a link needs, from every store, and nothing that is as a page opens', () => {
    const explorer = openExplorer({ route: 'a,c', walk: '400', speed: '4' });
    explorer.PICK_STATION(stationId('b'));
    expect(explorer.address).toEqual({ station: 'b', route: 'a,c', walk: '400', speed: '4' });
    expect(openExplorer().address).toEqual({});
  });

  test("picks a station clicked on the map as the route's end with Route in sight, else opens it", () => {
    const explorer = openExplorer({ tab: 'route' });
    explorer.CLICK_STATION(stationId('a'));
    expect(useToolsStore().routeEnds.from).toBe('a');
    expect(explorer.views).toEqual([]);
    explorer.OPEN_SECTION('lines');
    explorer.CLICK_STATION(stationId('a'));
    expect(explorer.views).toEqual([station('a')]);
    explorer.CLICK_STATION(null);
    expect(explorer.views).toEqual([]);
  });

  /**
   * The network shown.
   *
   * @returns Its facts.
   */
  const shownFacts = () => required(useNetworkStore().facts ?? undefined, 'the facts');

  /**
   * The explorer opened, its stores told by the renderer's own map on a stand-in.
   *
   * @param query - The address's query.
   * @returns The explorer, and the map: `show` gives it the props as the effect does.
   */
  const explorerOnMap = (query: ExplorerQuery = {}) => {
    const explorer = openExplorer(query);
    const timeStore = useTimeStore();
    const props = () => required(explorer.mapProps ?? undefined, 'the props');
    const { map, frame, ready } = mapOnStandIn(props(), {
      time: time => timeStore.SET_TIME(time),
      step: step => timeStore.SET_STEP(step),
    });
    useMapStore().ATTACH(map);
    return { explorer, timeStore, map, frame, ready, show: () => map.update(props()) };
  };

  test('opens on the moment the address names, on the map itself', () => {
    const { timeStore, ready } = explorerOnMap({ at: '1935-06-01' });
    ready();
    expect(timeStore.time).toMatchObject({ ...useNetworkStore().facts?.playheads.on(Date.UTC(1935, 5, 1)), atRest: false });
  });

  test('opens a plan picked before the map is ready built, no command needed', () => {
    const { explorer, timeStore, show, ready } = explorerOnMap();
    explorer.SHOW_PLAN(planId('extension'));
    show();
    ready();
    expect(timeStore.time).toMatchObject({ ...useNetworkStore().facts?.playheads.end(), atRest: true, inPlan: true });
  });

  test('shows another plan with it built, and the network as built at today, once the map has its props', () => {
    const { explorer, timeStore, show, frame, ready } = explorerOnMap();
    ready();
    explorer.SHOW_PLAN(planId('extension'));
    show();
    frame();
    expect(timeStore.time).toMatchObject({ ...useNetworkStore().facts?.playheads.end(), atRest: true });
    explorer.SHOW_PLAN(undefined);
    show();
    frame();
    expect(timeStore.time).toMatchObject({ ...useNetworkStore().facts?.playheads.today(), atToday: true });
  });

  test('hides a line on the day shown, closing its view, and shows it again on that day', () => {
    const { explorer, timeStore, map, show, frame, ready } = explorerOnMap({ line: 'blue' });
    ready();
    const day = Date.UTC(1935, 0, 1);
    map.seek(shownFacts().playheads.on(day));
    frame();
    explorer.SHOW_LINES([lineId('blue')], false);
    expect(useNetworkStore().hidden).toEqual(['blue']);
    // The line hidden is gone from what is open.
    expect(explorer.views).toEqual([]);
    // Known at once, before any frame.
    expect(timeStore.time?.time).toBe(day);
    show();
    frame();
    expect(timeStore.time).toMatchObject(shownFacts().playheads.on(day));
    explorer.SHOW_LINES([lineId('blue')], true);
    show();
    frame();
    expect(timeStore.time).toMatchObject(shownFacts().playheads.on(day));
  });

  test('keeps a day named by the address through a line shown before the map is ready', () => {
    const { explorer, timeStore, show, ready } = explorerOnMap({ at: '1935-01-01' });
    explorer.SHOW_LINES([lineId('blue')], false);
    show();
    ready();
    expect(timeStore.time).toMatchObject(shownFacts().playheads.on(Date.UTC(1935, 0, 1)));
  });

  test('keeps a plan built as a line is hidden and shown: where the map rests stays its rest', () => {
    const { explorer, timeStore, show, frame, ready } = explorerOnMap({ plan: 'extension' });
    ready();
    explorer.SHOW_LINES([lineId('green')], false);
    show();
    frame();
    explorer.SHOW_LINES([lineId('green')], true);
    show();
    frame();
    expect(timeStore.time).toMatchObject({ ...useNetworkStore().facts?.playheads.end(), atRest: true });
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
    useLayoutStore().SET_SCREEN({ phone: true, tabLabels: false });
    explorer.PICK_SECTION('lines');
    expect(useLayoutStore().sheet).toBe('half');
  });

  test('opens one dialog at a time, closing only its own', () => {
    const explorer = openExplorer();
    explorer.OPEN_DIALOG('search');
    explorer.OPEN_DIALOG('help');
    expect(explorer.dialog).toBe('help');
    explorer.CLOSE_DIALOG('search');
    expect(explorer.dialog).toBe('help');
    explorer.CLOSE_DIALOG('help');
    expect(explorer.dialog).toBeNull();
    explorer.OPEN_DIALOG('help');
    explorer.SET_MAP_ONLY(true);
    expect(explorer.dialog).toBeNull();
  });
});
