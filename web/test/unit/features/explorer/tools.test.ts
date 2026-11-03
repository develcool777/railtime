import { describe, expect, test } from 'vitest';

import { mapOverlayOf, overlayRequestOf, stationPickOf } from '~/features/explorer/tools.utils';

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

  describe('stationPickOf', () => {
    const bank = { id: 'bank', name: 'Bank' };
    const oval = { id: 'oval', name: 'Oval' };
    const kennington = { id: 'kennington', name: 'Kennington' };
    const empty = { from: null, to: null };

    test("picks a route's start, then its end, then its end again", () => {
      const pick = (routeEnds: { from: typeof bank | null; to: typeof bank | null }, stop: typeof bank) =>
        stationPickOf({ section: 'route', picking: true, routeEnds }, stop);
      expect(pick(empty, bank)).toEqual({ kind: 'route', ends: { from: bank, to: null } });
      expect(pick({ from: bank, to: null }, oval)).toEqual({ kind: 'route', ends: { from: bank, to: oval } });
      expect(pick({ from: bank, to: oval }, kennington)).toEqual({ kind: 'route', ends: { from: bank, to: kennington } });
    });

    test('ends nothing at its own start', () => {
      expect(stationPickOf({ section: 'route', picking: true, routeEnds: { from: bank, to: null } }, bank)).toEqual({
        kind: 'route',
        ends: { from: bank, to: null },
      });
    });

    test("picks a reach's start with Reach in sight", () => {
      expect(stationPickOf({ section: 'reach', picking: true, routeEnds: empty }, oval)).toEqual({ kind: 'reach', from: oval });
    });

    test('opens the station in any other section, out of sight, or under a view pushed over it', () => {
      expect(stationPickOf({ section: 'lines', picking: true, routeEnds: empty }, bank)).toEqual({ kind: 'open' });
      expect(stationPickOf({ section: 'route', picking: false, routeEnds: empty }, bank)).toEqual({ kind: 'open' });
      expect(stationPickOf({ section: 'reach', picking: false, routeEnds: empty }, bank)).toEqual({ kind: 'open' });
    });
  });
});
