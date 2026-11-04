import type { ChangeInfo, LineDetails, LineInfo, PlanInfo, StationInfo } from '@railtime/network/facts.types';
import { openExplorer } from '@test/support/factories/explorer.utils';
import { timeAt } from '@test/support/factories/timeState.utils';
import { describe, expect, test } from 'vitest';

import { usePanelStore } from '~/features/explorer/panel/panel.store';
import type { SectionTopInput } from '~/features/explorer/panel/panel.types';
import { lineTop, marksOf, planLegendOf, planSummaryOf, sectionLabelOf, sectionTop, sectionsOf, stationTop } from '~/features/explorer/panel/panel.utils';
import { useTimeStore } from '~/features/explorer/time/time.store';

/**
 * A line, for the Lines section.
 *
 * @param id - Its id and name.
 * @param year - The year it opened; `null` for a plan's.
 * @returns The line.
 */
const line = (id: string, year: number | null): LineInfo => ({
  id,
  name: id,
  network: 'metro',
  networkName: 'Metro',
  color: { light: '#ff0000', dark: '#ff0000' },
  opened: year === null ? null : Date.UTC(year, 0, 1),
});

/**
 * A change in the timeline.
 *
 * @param index - Its position.
 * @param year - Its year; `null` for a plan's.
 * @returns The change.
 */
const change = (index: number, year: number | null): ChangeInfo => ({
  index,
  kind: 'open',
  time: year === null ? null : Date.UTC(year, 5, 1),
  title: `Change ${index}`,
  color: { light: '#000000', dark: '#000000' },
  stations: [],
});

/**
 * A section's top, as the explorer asks for it: Lines, three lines on the map and one hidden, nothing playing.
 *
 * @param overrides - What differs.
 * @returns The input.
 */
const sectionInput = (overrides: Partial<SectionTopInput>): SectionTopInput => ({
  section: 'lines',
  label: 'Lines',
  playing: false,
  hasPlan: false,
  lines: [line('red', 1900), line('blue', 1950), line('green', null)],
  hidden: 1,
  changes: [change(0, 1900), change(1, 1950), change(2, null)],
  currentChange: null,
  time: timeAt({}),
  planCount: 2,
  stationCount: 3,
  ...overrides,
});

const STATION: StationInfo = {
  id: 'centre',
  name: 'Centre',
  otherNames: [],
  lines: [
    { id: 'blue', name: 'Blue', color: { light: '#0000ff', dark: '#0000ff' }, opened: '1950-03-01', calls: true },
    { id: 'red', name: 'Red', color: { light: '#ff0000', dark: '#ff0000' }, opened: '1900-06-01', calls: true },
  ],
  formerNames: [],
  transfers: [],
};

describe('PanelUtils', () => {
  describe('stationTop', () => {
    test('says when its first line called there, and its lines’ colours', () => {
      expect(stationTop(STATION, 'Lines')).toEqual({
        title: 'Centre',
        context: 'opened 1900',
        dots: ['light-dark(#0000ff, #0000ff)', 'light-dark(#ff0000, #ff0000)'],
        backLabel: 'Lines',
      });
    });

    test('gives its names in other languages first', () => {
      expect(stationTop({ ...STATION, otherNames: ['Центр'] }, 'Lines').context).toBe('Центр · opened 1900');
    });

    test('is planned when no line has called there yet', () => {
      const planned = { ...STATION, lines: [{ id: 'green', name: 'Green', color: { light: '#00ff00', dark: '#00ff00' }, opened: null, calls: false }] };
      expect(stationTop(planned, 'Plans').context).toBe('planned');
    });
  });

  describe('lineTop', () => {
    const details: LineDetails = { ...line('red', 1900), stations: 12, km: 9.6, branches: [[{ id: 'a', name: 'A' }]], changes: [] };

    test('gives its size while it is open', () => {
      expect(lineTop(details, 'Lines')).toEqual({
        title: 'red',
        context: 'opened 1900 · 12 stations · 10 km',
        dots: ['light-dark(#ff0000, #ff0000)'],
        backLabel: 'Lines',
      });
    });

    test('leaves the size out when it is not open, and a plan’s line is planned', () => {
      expect(lineTop({ ...details, branches: [] }, 'Lines').context).toBe('opened 1900');
      expect(lineTop({ ...details, opened: null, branches: [] }, 'Lines').context).toBe('planned');
    });
  });

  describe('sectionTop', () => {
    test('counts the lines, and those hidden while any are', () => {
      expect(sectionTop(sectionInput({}))).toEqual({ title: 'Lines', context: '3 lines · 1 hidden' });
      expect(sectionTop(sectionInput({ hidden: 0 }))).toEqual({ title: 'Lines', context: '3 lines' });
    });

    test('counts the changes since the first dated one', () => {
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes' }))).toEqual({ title: 'Changes', context: '3 changes since 1900' });
    });

    test('while playing, Changes says what plays and where it is', () => {
      const top = sectionTop(
        sectionInput({ section: 'changes', label: 'Changes', playing: true, currentChange: 1, time: timeAt({ time: Date.UTC(1950, 5, 1) }) }),
      );
      expect(top.title).toBe('Playing history');
      expect(top.context).toMatch(/^2 of 3 · .*1950$/);
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes', playing: true, hasPlan: true })).title).toBe('Playing the plan');
    });

    test('counts the changes alone when none is dated, and while playing between changes', () => {
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes', changes: [change(0, null)] })).context).toBe('1 change');
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes', playing: true, currentChange: null }))).toEqual({
        title: 'Playing history',
        context: '3 changes since 1900',
      });
    });

    test('while playing a plan, Changes says Plan, not a date', () => {
      const top = sectionTop(
        sectionInput({ section: 'changes', label: 'Changes', playing: true, hasPlan: true, currentChange: 2, time: timeAt({ inPlan: true }) }),
      );
      expect(top).toEqual({ title: 'Playing the plan', context: '3 of 3 · Plan' });
    });

    test('while playing with no time yet, Changes counts them', () => {
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes', playing: true, currentChange: 1, time: null })).context).toBe(
        '3 changes since 1900',
      );
    });

    test('counts the stations on the map', () => {
      expect(sectionTop(sectionInput({ section: 'stations', label: 'Stations' }))).toEqual({ title: 'Stations', context: '3 stations on the map' });
    });

    test('says what each tool section is for', () => {
      expect((['route', 'insights', 'reach', 'coverage'] as const).map(section => sectionTop(sectionInput({ section, label: section })).context)).toEqual([
        'Between any two stations, on the date shown',
        'How the network grew, and its records',
        'How far you get from a station',
        'How much of the city is near a station',
      ]);
      expect(sectionTop(sectionInput({ section: 'route', label: 'Route' })).title).toBe('Route');
    });

    test('counts the plans, one in the singular', () => {
      expect(sectionTop(sectionInput({ section: 'plans', label: 'Plans' })).context).toBe('2 plans drawn up');
      expect(sectionTop(sectionInput({ section: 'plans', label: 'Plans', planCount: 1 })).context).toBe('1 plan drawn up');
    });
  });

  describe('sectionsOf, sectionLabelOf', () => {
    test('lists Plans only for a city with plans, and names each section as the rail does', () => {
      expect(sectionsOf(0).map(entry => entry.id)).not.toContain('plans');
      expect(sectionsOf(2).map(entry => entry.id)).toContain('plans');
      expect(sectionLabelOf('stations')).toBe('Stations');
    });
  });

  describe('marksOf', () => {
    const bank = { id: 'bank', name: 'Bank' };
    const oval = { id: 'oval', name: 'Oval' };

    test('marks a plan shown, a route with both ends, and a reach with its start', () => {
      expect(marksOf({ planShown: true, routeEnds: { from: bank, to: oval }, reachFrom: oval })).toEqual({
        plans: 'A plan is shown',
        route: 'A route from Bank to Oval is set',
        reach: 'How far one gets from Oval is set',
      });
    });

    test('marks nothing for a route with one end, or nothing set', () => {
      expect(marksOf({ planShown: false, routeEnds: { from: bank, to: null }, reachFrom: null })).toEqual({});
    });
  });

  describe('planSummaryOf, planLegendOf', () => {
    const plan: PlanInfo = {
      id: 'extension',
      name: 'Extension',
      status: 'planned',
      facts: { stations: 2, km: 1.6, lines: [{ id: 'red', name: 'Red', color: { light: '#ff0000', dark: '#ff6666' } }] },
    } as PlanInfo;

    test('sums the plan shown up for the time control: its name, its status, what it adds', () => {
      expect(planSummaryOf(plan)).toEqual({ name: 'Extension', status: 'Planned', facts: 'adds 2 stations · 2 km' });
      expect(planSummaryOf(undefined)).toBeUndefined();
    });

    test("keys the plan's track in its first line's colour while the map shows it, paused", () => {
      expect(planLegendOf(plan, true)).toEqual({ name: 'Extension', color: 'light-dark(#ff0000, #ff6666)' });
      expect(planLegendOf(plan, false)).toBeNull();
      expect(planLegendOf({ ...plan, facts: { ...plan.facts, lines: [] } }, true)?.color).toBe('var(--ui-text-highlighted)');
    });
  });
});

describe('PanelStore', () => {
  test('shows the station open at the moment the map shows, with the way back to the line it was opened over', () => {
    openExplorer({ line: 'red', station: 'b' });
    useTimeStore().SET_TIME(timeAt({}));
    const panel = usePanelStore();
    expect(panel.station?.name).toBe('B');
    expect(panel.panelTop.title).toBe('B');
    expect(panel.panelTop.backLabel).toBe('Red');
  });

  test('lists no stations while the map moves, when the panel follows the changes', () => {
    openExplorer();
    useTimeStore().SET_TIME(timeAt({}));
    expect(usePanelStore().stations.length).toBeGreaterThan(0);
    useTimeStore().SET_TIME(timeAt({ playing: true }));
    expect(usePanelStore().stations).toEqual([]);
  });
});
