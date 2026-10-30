import type { ChangeInfo, TimeState } from '@railtime/renderer/transitMap.types';
import { describe, expect, test } from 'vitest';
import { changesByDecade, currentChangeIndex } from '~/features/explorer/changes.utils';

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

const CHANGES = [change(0, 1863), change(1, 1868), change(2, 1933), change(3, 1933), change(4, null)];

/**
 * Where the map is.
 *
 * @param overrides - What differs from today's map, paused.
 * @returns The time state.
 */
const timeAt = (overrides: Partial<TimeState>): TimeState => ({
  time: Date.UTC(2026, 0, 1),
  cursor: 4,
  stepCount: 5,
  todayCursor: 4,
  future: false,
  playing: false,
  stats: { stations: 0, km: 0, lines: 0 },
  ...overrides,
});

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
});
