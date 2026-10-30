import type { ChangeInfo } from '@railtime/renderer/transitMap.types';
import { describe, expect, test } from 'vitest';
import { positionOf, targetAt, thumbPosition, timelineLabels, timelineTicks } from '~/features/explorer/timeline.utils';
import type { TimelineScale } from '~/features/explorer/timeline.types';

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
  color: '#ff0000',
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
    test('marks each change but renames, stacking a year, closures small, planned ones in the zone', () => {
      const ticks = timelineTicks(PLANNED, [
        change(0, Date.UTC(1950, 2, 1)),
        change(1, Date.UTC(1950, 5, 1), 'close'),
        change(2, Date.UTC(1960, 0, 1), 'rename'),
        change(3, null),
      ]);
      expect(ticks.map(tick => tick.index)).toEqual([0, 1, 3]);
      expect(ticks.map(tick => tick.level)).toEqual([0, 1, 0]);
      expect(ticks[1]).toMatchObject({ closure: true, label: '1950 · Change 1' });
      expect(ticks[2]).toMatchObject({ left: expect.closeTo(0.88), label: 'Future · Change 3' });
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
});
