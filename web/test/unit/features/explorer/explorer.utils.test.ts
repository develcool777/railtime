import { lineId, planId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import type { PanelView } from '~/features/explorer/explorer.types';
import {
  chromeOf,
  openingSectionOf,
  openLineOf,
  openStationOf,
  railSectionOf,
  recordedStateOf,
  walkedTo,
  withoutStations,
  withStation,
} from '~/features/explorer/explorer.utils';

const CENTRAL: PanelView = { kind: 'line', id: lineId('central') };
const station = (id: string): PanelView => ({ kind: 'station', id: stationId(id) });

describe('ExplorerUtils', () => {
  describe('withStation', () => {
    test('opens a station over the line open, in place of any walk', () => {
      expect(withStation([], stationId('bank'))).toEqual([station('bank')]);
      expect(withStation([CENTRAL], stationId('bank'))).toEqual([CENTRAL, station('bank')]);
      expect(withStation([CENTRAL, station('bank'), station('oval')], stationId('angel'))).toEqual([CENTRAL, station('angel')]);
    });
  });

  describe('walkedTo', () => {
    test('walks on from the station open, so Back returns to it', () => {
      expect(walkedTo([CENTRAL, station('bank')], stationId('oval'))).toEqual([CENTRAL, station('bank'), station('oval')]);
    });

    test('stays put for the station open, or with no station open', () => {
      const views = [station('bank')];
      expect(walkedTo(views, stationId('bank'))).toBe(views);
      expect(walkedTo([CENTRAL], stationId('bank'))).toEqual([CENTRAL]);
    });
  });

  describe('withoutStations', () => {
    test('closes the stations, back to the line under them', () => {
      expect(withoutStations([CENTRAL, station('bank'), station('oval')])).toEqual([CENTRAL]);
      expect(withoutStations([station('bank')])).toEqual([]);
    });
  });

  describe('openStationOf', () => {
    test('finds the station open', () => {
      expect(openStationOf([CENTRAL, station('bank'), station('oval')])).toBe('oval');
      expect(openStationOf([CENTRAL])).toBeNull();
    });
  });

  describe('openLineOf', () => {
    test('finds the line open, or under the station open', () => {
      expect(openLineOf([CENTRAL, station('bank'), station('oval')])).toBe('central');
      expect(openLineOf([station('bank')])).toBeNull();
      expect(openLineOf([])).toBeNull();
    });
  });

  describe('railSectionOf', () => {
    test('marks the section a pushed view belongs to, else the one open', () => {
      expect(railSectionOf('route', [])).toBe('route');
      expect(railSectionOf('route', [CENTRAL])).toBe('lines');
      expect(railSectionOf('route', [CENTRAL, station('bank')])).toBe('stations');
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

  describe('recordedStateOf', () => {
    const asked = { status: 'ready', settled: true, playing: false, playedOut: false } as const;

    test('is loading until the map is ready, then ready to start', () => {
      expect(recordedStateOf({ ...asked, status: 'loading' })).toBe('loading');
      expect(recordedStateOf(asked)).toBe('ready');
    });

    test('plays while history does, and on until the camera has come to rest on the whole network', () => {
      expect(recordedStateOf({ ...asked, playing: true })).toBe('playing');
      expect(recordedStateOf({ ...asked, playedOut: true, settled: false })).toBe('playing');
      expect(recordedStateOf({ ...asked, playedOut: true })).toBe('done');
    });
  });

  describe('openingSectionOf', () => {
    test('opens on Plans with a plan shown, else on Lines', () => {
      expect(openingSectionOf(planId('extension'))).toBe('plans');
      expect(openingSectionOf(undefined)).toBe('lines');
    });
  });
});
