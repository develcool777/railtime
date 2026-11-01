import type { ChangeInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { isAtRest, isDated, positionOf, targetAt, thumbPosition, timelineLabels, timelineTicks } from '~/features/explorer/time/timeline.utils';
import type { TimelineScale } from '~/features/explorer/time/timeline.types';
import { timeAt } from '@test/support/factories/timeState.utils';

const START = Date.UTC(1900, 0, 1);
const END = Date.UTC(2000, 0, 1);
/** A hundred years, then a plan of four changes. */
const PLANNED: TimelineScale = { start: START, end: END, datedCount: 3, plannedCount: 4 };
const DATED: TimelineScale = { ...PLANNED, plannedCount: 0 };

const change = (index: number, time: number | null, kind: ChangeInfo['kind'] = 'open'): ChangeInfo => ({
  index,
  time,
  kind,
  title: `Change ${index}`,
  color: { light: '#ff0000', dark: '#ff0000' },
  stations: [],
});

describe('TimelineUtils', () => {
  describe('positionOf', () => {
    test('spreads the dates over the width, or what the Future zone leaves', () => {
      expect(positionOf(DATED, Date.UTC(1950, 0, 1))).toBeCloseTo(0.5, 2);
      expect(positionOf(PLANNED, END)).toBeCloseTo(0.84);
      expect(positionOf(PLANNED, Date.UTC(2100, 0, 1))).toBeCloseTo(0.84);
    });
  });

  describe('thumbPosition', () => {
    test("stands on the date, or in the Future zone past the plan's changes built", () => {
      expect(thumbPosition(PLANNED, START, 0, false)).toBe(0);
      expect(thumbPosition(PLANNED, END, 3, true)).toBeCloseTo(0.84);
      expect(thumbPosition(PLANNED, END, 5, true)).toBeCloseTo(0.92);
      expect(thumbPosition(PLANNED, END, 7, true)).toBeCloseTo(1);
    });
  });

  describe('timelineTicks', () => {
    test('marks every change, stacking a year, each kind its look, planned ones in the zone', () => {
      const ticks = timelineTicks(PLANNED, [
        change(0, Date.UTC(1950, 2, 1)),
        change(1, Date.UTC(1950, 5, 1), 'close'),
        change(2, Date.UTC(1960, 0, 1), 'rename'),
        change(3, null),
      ]);
      expect(ticks.map(tick => tick.index)).toEqual([0, 1, 2, 3]);
      expect(ticks.map(tick => tick.level)).toEqual([0, 1, 0, 0]);
      expect(ticks.map(tick => tick.mark)).toEqual(['opening', 'closure', 'rename', 'opening']);
      expect(ticks[1]).toMatchObject({ label: '1950 · Change 1' });
      expect(ticks[3]).toMatchObject({ left: expect.closeTo(0.88), label: 'Future · Change 3' });
    });
  });

  describe('timelineLabels', () => {
    test('writes the first year, round years between, and Today at the end', () => {
      expect(timelineLabels(DATED).map(label => label.text)).toEqual(['1900', '1925', '1950', '1975', 'Today']);
      expect(timelineLabels(PLANNED).at(-1)).toEqual({ text: 'Today', left: expect.closeTo(0.84), today: true });
    });
  });

  describe('targetAt', () => {
    test('is a date, or in the Future zone the plan built to its nearest change, all of it at the end', () => {
      expect(targetAt(DATED, 0.5)).toEqual({ kind: 'date', time: Date.UTC(1950, 0, 1) });
      expect(targetAt(PLANNED, 0.84 + 0.04)).toEqual({ kind: 'change', index: 3 });
      expect(targetAt(PLANNED, 0.84 + 0.12)).toEqual({ kind: 'change', index: 5 });
      expect(targetAt(PLANNED, 1)).toEqual({ kind: 'future' });
      expect(targetAt(PLANNED, 0.845)).toEqual({ kind: 'date', time: END });
    });
  });

  describe('isAtRest', () => {
    test('is today, without a plan', () => {
      expect(isAtRest(timeAt({}), false)).toBe(true);
      expect(isAtRest(timeAt({ cursor: 2, time: Date.UTC(1935, 0, 1) }), false)).toBe(false);
      expect(isAtRest(timeAt({ future: true }), false)).toBe(false);
    });

    test('is the plan built, with one', () => {
      expect(isAtRest(timeAt({ future: true, cursor: 5 }), true)).toBe(true);
      expect(isAtRest(timeAt({}), true)).toBe(false);
    });

    test('is at rest before the map mounts', () => {
      expect(isAtRest(null, false)).toBe(true);
    });
  });

  describe('isDated', () => {
    test('names a day away from today', () => {
      expect(isDated(timeAt({ cursor: 2, time: Date.UTC(1935, 0, 1) }), false)).toBe(true);
      expect(isDated(timeAt({}), false)).toBe(false);
    });

    test('with a plan, names today too, and never its future', () => {
      expect(isDated(timeAt({}), true)).toBe(true);
      expect(isDated(timeAt({ future: true, cursor: 5 }), true)).toBe(false);
    });

    test('names nothing before the map mounts', () => {
      expect(isDated(null, false)).toBe(false);
    });
  });
});
