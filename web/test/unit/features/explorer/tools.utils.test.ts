import { NetworkFacts } from '@railtime/network/facts.service';
import type { CoverageInfo } from '@railtime/network/facts.types';
import { tinyNetwork } from '@railtime/network/testing/tinyNetwork';
import type { StationId } from '@railtime/schema/network.types';
import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import type { RouteEnds } from '~/features/explorer/tools.types';
import {
  foundCoverageOf,
  foundReachOf,
  foundRoutesOf,
  mapOverlayOf,
  mapPickHint,
  overlayRequestOf,
  routeAimOf,
  stationIn,
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
    const bank = stationId('bank');
    const oval = stationId('oval');
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
    const bank = stationId('bank');
    const oval = stationId('oval');

    test('aims at where the route starts until it has one, then at where it ends', () => {
      expect(routeAimOf({ from: null, to: null })).toBe('from');
      expect(routeAimOf({ from: null, to: oval })).toBe('from');
      expect(routeAimOf({ from: bank, to: null })).toBe('to');
      expect(routeAimOf({ from: bank, to: oval })).toBe('to');
    });
  });

  describe('stationPickOf', () => {
    const bank = stationId('bank');
    const oval = stationId('oval');
    const kennington = stationId('kennington');
    const empty = { from: null, to: null };
    const pick = (routeEnds: RouteEnds, routeAim: 'from' | 'to', station: StationId) =>
      stationPickOf({ section: 'route', picking: true, routeEnds, routeAim }, station);

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

  describe('stationIn', () => {
    test('takes a station of the network shown, and nothing else', () => {
      const facts = NetworkFacts.create(tinyNetwork());
      expect(stationIn(facts, 'a')).toBe('a');
      expect([stationIn(facts, 'e'), stationIn(facts, null), stationIn(facts, undefined), stationIn(null, 'a')]).toEqual([null, null, null, null]);
    });
  });

  describe('mapPickHint', () => {
    test('says a click on the map picks the end, or changes it once picked', () => {
      expect(mapPickHint('start', false)).toBe('Click the map for the start.');
      expect(mapPickHint('end', true)).toBe('Click the map to change the end.');
    });
  });

  describe('foundCoverageOf', () => {
    test('takes the coverage the map found, and nothing for another overlay or none', () => {
      const coverage: CoverageInfo = { name: 'Test', source: 'test', km2: 4, metres: 800, share: 0.5, bands: [], beyond: { share: 0.5, km2: 2 } };
      expect(foundCoverageOf({ kind: 'coverage', coverage })).toBe(coverage);
      expect(foundCoverageOf({ kind: 'coverage', coverage: null })).toBeNull();
      expect(foundCoverageOf({ kind: 'reach', reach: null })).toBeNull();
      expect(foundCoverageOf(null)).toBeNull();
    });
  });

  describe('foundRoutesOf, foundReachOf', () => {
    test('take what the map found for their own overlay, and nothing for another or none', () => {
      const route = { kind: 'route' as const, routes: [], shown: null };
      expect(foundRoutesOf(route)).toEqual({ routes: [], shown: null });
      expect(foundReachOf(route)).toBeNull();
      expect(foundReachOf({ kind: 'reach', reach: null })).toBeNull();
      expect(foundRoutesOf(null)).toBeNull();
    });
  });
});
