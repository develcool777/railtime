import { describe, expect, test } from 'vitest';

import { openExplorer } from '@test/support/factories/explorer.utils';

import { useNetworkStore } from '~/features/explorer/network.store';
import { useToolsStore } from '~/features/explorer/tools.store';
import {
  foundCoverageOf,
  foundReachOf,
  foundRoutesOf,
  mapOverlayOf,
  mapPickHint,
  overlayRequestOf,
  routeAimOf,
  stationPickOf,
} from '~/features/explorer/tools.utils';

describe('ToolsUtils', () => {
  describe('mapOverlayOf', () => {
    test("draws the section's own overlay, and none for a section without one", () => {
      expect(mapOverlayOf('route', 'timeline')).toBe('route');
      expect(mapOverlayOf('reach', 'timeline')).toBe('reach');
      expect(mapOverlayOf('coverage', 'timeline')).toBe('coverage');
      expect(mapOverlayOf('lines', 'timeline')).toBeNull();
    });

    test('hides a route and a reach while playing, and keeps coverage, which grows with the network', () => {
      expect(mapOverlayOf('route', 'playing')).toBeNull();
      expect(mapOverlayOf('reach', 'playing')).toBeNull();
      expect(mapOverlayOf('coverage', 'playing')).toBe('coverage');
    });
  });

  describe('overlayRequestOf', () => {
    const bank = { id: 'bank', name: 'Bank' };
    const oval = { id: 'oval', name: 'Oval' };
    const none = { overlay: null, routeEnds: { from: bank, to: oval }, routeOption: 0, reachFrom: bank, coverageMetres: 400 as const };

    test("asks for the section's overlay once it has what it needs", () => {
      expect(overlayRequestOf({ ...none, overlay: 'route' })).toEqual({ kind: 'route', from: 'bank', to: 'oval', option: 0 });
      expect(overlayRequestOf({ ...none, overlay: 'reach' })).toEqual({ kind: 'reach', from: 'bank' });
      expect(overlayRequestOf({ ...none, overlay: 'coverage' })).toEqual({ kind: 'coverage', metres: 400 });
    });

    test('asks for nothing before a route has both ends or a reach its start, nor with no overlay', () => {
      expect(overlayRequestOf({ ...none, overlay: 'route', routeEnds: { from: bank, to: null } })).toBeNull();
      expect(overlayRequestOf({ ...none, overlay: 'reach', reachFrom: null })).toBeNull();
      expect(overlayRequestOf(none)).toBeNull();
    });
  });

  describe('routeAimOf', () => {
    const bank = { id: 'bank', name: 'Bank' };
    const oval = { id: 'oval', name: 'Oval' };

    test('aims at where the route starts until it has one, then at where it ends', () => {
      expect(routeAimOf({ from: null, to: null })).toBe('from');
      expect(routeAimOf({ from: null, to: oval })).toBe('from');
      expect(routeAimOf({ from: bank, to: null })).toBe('to');
      expect(routeAimOf({ from: bank, to: oval })).toBe('to');
    });
  });

  describe('stationPickOf', () => {
    const bank = { id: 'bank', name: 'Bank' };
    const oval = { id: 'oval', name: 'Oval' };
    const kennington = { id: 'kennington', name: 'Kennington' };
    const empty = { from: null, to: null };
    const pick = (routeEnds: { from: typeof bank | null; to: typeof bank | null }, routeAim: 'from' | 'to', stop: typeof bank) =>
      stationPickOf({ section: 'route', picking: true, routeEnds, routeAim }, stop);

    test('fills the end of the route aimed at, picked or not', () => {
      expect(pick(empty, 'from', bank)).toEqual({ kind: 'route', ends: { from: bank, to: null } });
      expect(pick({ from: bank, to: null }, 'to', oval)).toEqual({ kind: 'route', ends: { from: bank, to: oval } });
      expect(pick({ from: bank, to: oval }, 'to', kennington)).toEqual({ kind: 'route', ends: { from: bank, to: kennington } });
      expect(pick({ from: bank, to: oval }, 'from', kennington)).toEqual({ kind: 'route', ends: { from: kennington, to: oval } });
      expect(pick(empty, 'to', oval)).toEqual({ kind: 'route', ends: { from: null, to: oval } });
    });

    test("leaves the route as it is at its other end's station", () => {
      expect(pick({ from: bank, to: null }, 'to', bank)).toEqual({ kind: 'route', ends: { from: bank, to: null } });
      expect(pick({ from: bank, to: oval }, 'from', oval)).toEqual({ kind: 'route', ends: { from: bank, to: oval } });
    });

    test("picks a reach's start with Reach in sight", () => {
      expect(stationPickOf({ section: 'reach', picking: true, routeEnds: empty, routeAim: 'from' }, oval)).toEqual({ kind: 'reach', from: oval });
    });

    test('opens the station in any other section, out of sight, or under a view pushed over it', () => {
      expect(stationPickOf({ section: 'lines', picking: true, routeEnds: empty, routeAim: 'from' }, bank)).toEqual({ kind: 'open' });
      expect(stationPickOf({ section: 'route', picking: false, routeEnds: empty, routeAim: 'from' }, bank)).toEqual({ kind: 'open' });
      expect(stationPickOf({ section: 'reach', picking: false, routeEnds: empty, routeAim: 'from' }, bank)).toEqual({ kind: 'open' });
    });
  });

  describe('mapPickHint', () => {
    test('says a click on the map picks the end, or changes it once picked', () => {
      expect(mapPickHint('start', false)).toBe('Click the map for the start.');
      expect(mapPickHint('end', true)).toBe('Click the map to change the end.');
    });
  });

  describe('foundRoutesOf, foundReachOf, foundCoverageOf', () => {
    test('take what the map found for their own overlay, and nothing for another or none', () => {
      const route = { kind: 'route' as const, routes: [], shown: null };
      expect(foundRoutesOf(route)).toEqual({ routes: [], shown: null });
      expect(foundReachOf(route)).toBeNull();
      expect(foundReachOf({ kind: 'reach', reach: null })).toBeNull();
      expect(foundCoverageOf({ kind: 'coverage', coverage: null })).toBeNull();
      expect(foundRoutesOf(null)).toBeNull();
    });
  });
});

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
    expect(tools.routeEnds).toEqual({ from: { id: 'a', name: 'A' }, to: null });
    expect(tools.routeOption).toBe(1);
    expect(tools.reachFrom).toEqual({ id: 'b', name: 'B' });
    expect(tools.coverageMetres).toBe(800);
  });

  test("keeps only the ends the network made again has: a plan's station goes with the plan", () => {
    openExplorer({ plan: 'extension', route: 'a,e' });
    const tools = useToolsStore();
    expect(tools.routeEnds.to?.id).toBe('e');
    useNetworkStore().SHOW_PLAN(undefined);
    tools.KEEP_ON();
    expect(tools.routeEnds).toEqual({ from: { id: 'a', name: 'A' }, to: null });
    expect(tools.routeAim).toBe('to');
  });

  test('fetches the outline once, and says so when there is none', async () => {
    openExplorer();
    const tools = useToolsStore();
    const outline = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } };
    await tools.LOAD_BOUNDARY(servedAt(JSON.stringify(outline)));
    expect(tools.boundaryState).toBe('ready');
    expect(tools.boundary).toEqual(outline);
    await tools.LOAD_BOUNDARY(servedAt('not an outline'));
    expect(tools.boundaryState).toBe('ready');
    openExplorer();
    await useToolsStore().LOAD_BOUNDARY(servedAt('not an outline'));
    expect(useToolsStore().boundaryState).toBe('missing');
  });
});
