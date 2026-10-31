import type { ChangeInfo, LineDetails, LineInfo, StationInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import type { SectionTopInput } from '~/features/explorer/panel/panel.types';
import { lineTop, sectionTop, stationTop } from '~/features/explorer/panel/panel.utils';
import { timeAt } from '@test/support/factories/timeState.utils';

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
  color: '#ff0000',
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
  color: '#000000',
  stations: [],
});

/**
 * A section's top, as the explorer asks for it: Lines, two of three lines shown, nothing playing.
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
  visible: new Set(['red', 'blue']),
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
    { id: 'blue', name: 'Blue', color: '#0000ff', opened: '1950-03-01' },
    { id: 'red', name: 'Red', color: '#ff0000', opened: '1900-06-01' },
  ],
  formerNames: [],
  transfers: [],
};

describe('PanelUtils', () => {
  describe('stationTop', () => {
    test('says when its first line called there, and its lines’ colours', () => {
      expect(stationTop(STATION, 'Lines')).toEqual({ title: 'Centre', context: 'opened 1900', dots: ['#0000ff', '#ff0000'], backLabel: 'Lines' });
    });

    test('gives its names in other languages first', () => {
      expect(stationTop({ ...STATION, otherNames: ['Центр'] }, 'Lines').context).toBe('Центр · opened 1900');
    });

    test('is planned when no line has called there yet', () => {
      const planned = { ...STATION, lines: [{ id: 'green', name: 'Green', color: '#00ff00', opened: null }] };
      expect(stationTop(planned, 'Plans').context).toBe('planned');
    });
  });

  describe('lineTop', () => {
    const details: LineDetails = { ...line('red', 1900), stations: 12, km: 9.6, branches: [[{ id: 'a', name: 'A' }]], changes: [] };

    test('gives its size while it is open', () => {
      expect(lineTop(details, 'Lines')).toEqual({ title: 'red', context: 'opened 1900 · 12 stations · 10 km', dots: ['#ff0000'], backLabel: 'Lines' });
    });

    test('leaves the size out when it is not open, and a plan’s line is planned', () => {
      expect(lineTop({ ...details, branches: [] }, 'Lines').context).toBe('opened 1900');
      expect(lineTop({ ...details, opened: null, branches: [] }, 'Lines').context).toBe('planned');
    });
  });

  describe('sectionTop', () => {
    test('counts the lines, and those shown', () => {
      expect(sectionTop(sectionInput({}))).toEqual({ title: 'Lines', context: '3 lines · 2 shown' });
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
      expect(sectionTop(sectionInput({ section: 'changes', label: 'Changes', playing: true, hasPlan: true })).title).toBe('Playing the future');
    });

    test('counts the stations on the map', () => {
      expect(sectionTop(sectionInput({ section: 'stations', label: 'Stations' }))).toEqual({ title: 'Stations', context: '3 stations on the map' });
    });

    test('counts the plans, one in the singular', () => {
      expect(sectionTop(sectionInput({ section: 'plans', label: 'Plans' })).context).toBe('2 plans drawn up');
      expect(sectionTop(sectionInput({ section: 'plans', label: 'Plans', planCount: 1 })).context).toBe('1 plan drawn up');
    });
  });
});
