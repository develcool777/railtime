import type { ChangeInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { changesByDecade, currentChangeIndex, timelinePosition } from '~/features/explorer/changes/changes.utils';
import { timeAt } from '@test/support/factories/timeState.utils';

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

const CHANGES = [change(0, 1863), change(1, 1868), change(2, 1933), change(3, 1933), change(4, null)];

describe('ChangesUtils', () => {
  describe('changesByDecade', () => {
    test('puts each change under its decade, a plan’s under the future', () => {
      const groups = changesByDecade(CHANGES);
      expect(groups.map(group => [group.decade, group.changes.map(entry => entry.index)])).toEqual([
        ['1860s', [0, 1]],
        ['1930s', [2, 3]],
        ['Future', [4]],
      ]);
    });
  });

  describe('currentChangeIndex', () => {
    test('is the change playing, or the last played between two', () => {
      expect(currentChangeIndex(CHANGES, timeAt({ cursor: 2, playing: true }), true)).toBe(2);
      expect(currentChangeIndex(CHANGES, timeAt({ cursor: 2, playing: true }), false)).toBe(1);
    });

    test('is the last change of the year shown, once it has happened', () => {
      expect(currentChangeIndex(CHANGES, timeAt({ time: Date.UTC(1933, 11, 31), cursor: 4 }), false)).toBe(3);
      expect(currentChangeIndex(CHANGES, timeAt({ time: Date.UTC(1933, 0, 1), cursor: 2 }), false)).toBeNull();
      expect(currentChangeIndex(CHANGES, timeAt({ time: Date.UTC(1950, 0, 1), cursor: 4 }), false)).toBeNull();
    });

    test('is none in a plan’s future', () => {
      expect(currentChangeIndex(CHANGES, timeAt({ future: true, cursor: 5 }), false)).toBeNull();
    });
  });

  describe('timelinePosition', () => {
    test('marks the current change where it is in the run', () => {
      expect(timelinePosition([4, 5, 6], 5)).toBe(1);
    });

    test('marks every change done in a run that all came before', () => {
      expect(timelinePosition([1, 2, 3], 7)).toBe(3);
    });

    test('marks none in a run still ahead, or with no current change', () => {
      expect(timelinePosition([8, 9], 5)).toBe(-1);
      expect(timelinePosition([1, 2], null)).toBe(-1);
    });
  });
});
