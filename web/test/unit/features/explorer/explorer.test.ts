import { describe, expect, test } from 'vitest';
import type { PanelView } from '~/features/explorer/explorer.types';
import { chromeOf, mapOverlayOf, openOf, overlayRequestOf, railSectionOf, walkedTo, withStation, withoutStations } from '~/features/explorer/explorer.utils';

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

  describe('mapOverlayOf', () => {
    test("draws the section's own overlay, and none for a section without one", () => {
      expect(mapOverlayOf('route', 'rest')).toBe('route');
      expect(mapOverlayOf('reach', 'timeline')).toBe('reach');
      expect(mapOverlayOf('coverage', 'rest')).toBe('coverage');
      expect(mapOverlayOf('lines', 'rest')).toBeNull();
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
    const none = { overlay: null, routeEnds: { from: bank, to: oval }, routePreference: 'fastest' as const, reachFrom: bank };

    test("asks for the section's overlay once it has what it needs", () => {
      expect(overlayRequestOf({ ...none, overlay: 'route' })).toEqual({ kind: 'route', from: 'bank', to: 'oval', preference: 'fastest' });
      expect(overlayRequestOf({ ...none, overlay: 'reach' })).toEqual({ kind: 'reach', from: 'bank' });
      expect(overlayRequestOf({ ...none, overlay: 'coverage' })).toEqual({ kind: 'coverage' });
    });

    test('asks for nothing before a route has both ends or a reach its start, nor with no overlay', () => {
      expect(overlayRequestOf({ ...none, overlay: 'route', routeEnds: { from: bank, to: null } })).toBeNull();
      expect(overlayRequestOf({ ...none, overlay: 'reach', reachFrom: null })).toBeNull();
      expect(overlayRequestOf(none)).toBeNull();
    });
  });

  describe('chromeOf', () => {
    const desk = { phone: false, mapOnly: false, sheet: 'peek' as const, timeMode: 'rest' as const, minimap: true };

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
});
