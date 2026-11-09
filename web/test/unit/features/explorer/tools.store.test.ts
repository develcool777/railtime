import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { parseExplorerQuery } from '~/features/explorer/address/address.utils';
import { useToolsStore } from '~/features/explorer/tools.store';

describe('ToolsStore', () => {
  /**
   * An outline served as a data address, as a fetch reads one.
   *
   * @param body - What is served.
   * @returns Its address.
   */
  const servedAt = (body: string) => `data:application/json,${encodeURIComponent(body)}`;

  test('opens on the route and reach the address names, leaving out a station the network has not', () => {
    openExplorer({ route: 'a,nowhere,1', reach: 'b', walk: '800' });
    const tools = useToolsStore();
    expect(tools.routeEnds).toEqual({ from: 'a', to: null });
    expect(tools.routeOption).toBe(1);
    expect(tools.reachFrom).toBe('b');
    expect(tools.coverageMetres).toBe(800);
  });

  test('keeps an end through a network without it, drawing what the network shown has, and has it back', () => {
    const explorer = openExplorer({ plan: 'extension', route: 'a,e', reach: 'e', tab: 'route' });
    const tools = useToolsStore();
    expect(explorer.mapProps?.overlay).toEqual({ kind: 'route', from: 'a', to: 'e', option: 0 });
    explorer.SHOW_PLAN(undefined);
    expect(tools.routeEnds).toEqual({ from: 'a', to: 'e' });
    expect(tools.routeEndsShown).toEqual({ from: 'a', to: null });
    expect(tools.reachFromShown).toBeNull();
    expect(explorer.mapProps?.overlay).toBeNull();
    explorer.SHOW_PLAN(planId('extension'));
    expect(tools.routeEndsShown).toEqual({ from: 'a', to: 'e' });
    expect(explorer.mapProps?.overlay).toEqual({ kind: 'route', from: 'a', to: 'e', option: 0 });
  });

  test('keeps an end on a line hidden and shown again', () => {
    const explorer = openExplorer({ route: 'a,d', tab: 'route' });
    const tools = useToolsStore();
    const lines = [lineId('red'), lineId('green')];
    explorer.SHOW_LINES(lines, false);
    expect(tools.routeEndsShown.to).toBeNull();
    explorer.SHOW_LINES(lines, true);
    expect(tools.routeEndsShown).toEqual({ from: 'a', to: 'd' });
  });

  test('aims at the next end to fill, on what the network shown has, until another is chosen and the ends change', () => {
    const explorer = openExplorer({ plan: 'extension', route: 'e,a' });
    const tools = useToolsStore();
    expect(tools.routeAim).toBe('to');
    explorer.SHOW_PLAN(undefined);
    expect(tools.routeAim).toBe('from');
    tools.AIM_ROUTE('to');
    expect(tools.routeAim).toBe('to');
    tools.SET_ROUTE_END('from', stationId('b'));
    expect(tools.routeAim).toBe('to');
    tools.CLEAR_ROUTE();
    expect(tools.routeAim).toBe('from');
  });

  test('fetches the outline once, and says so when there is none', async () => {
    const outline = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } };
    openExplorer({}, tinyNetwork(), servedAt(JSON.stringify(outline)));
    const tools = useToolsStore();
    await tools.LOAD_BOUNDARY();
    expect(tools.boundaryState).toBe('ready');
    expect(tools.boundary).toEqual(outline);
    await tools.LOAD_BOUNDARY();
    expect(tools.boundaryState).toBe('ready');
    openExplorer({}, tinyNetwork(), servedAt('not an outline'));
    await useToolsStore().LOAD_BOUNDARY();
    expect(useToolsStore().boundaryState).toBe('missing');
  });

  test('drops an outline that comes once another city is open, which then fetches its own', async () => {
    const outline = (name: string) => ({ type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [] } });
    const explorer = openExplorer({}, tinyNetwork(), servedAt(JSON.stringify(outline('first'))));
    const tools = useToolsStore();
    const first = tools.LOAD_BOUNDARY();
    // Another city opens on the same stores, as the page does, before the first outline comes.
    explorer.OPEN({ stored: tinyNetwork(), asked: parseExplorerQuery({}), outline: servedAt(JSON.stringify(outline('second'))) });
    await first;
    expect(tools.boundaryState).toBe('idle');
    expect(tools.boundary).toBeNull();
    await tools.LOAD_BOUNDARY();
    expect(tools.boundary).toEqual(outline('second'));
  });
});
