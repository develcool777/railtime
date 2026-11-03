import type { ChangeInfo } from '@railtime/network/facts.types';
import { describe, expect, test } from 'vitest';
import { changeRows, changeState, changesByDecade, currentChangeIndex, findChanges } from '~/features/explorer/changes/changes.utils';
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
    test('puts each change under its decade, a plan’s under Plan', () => {
      const groups = changesByDecade(CHANGES);
      expect(groups.map(group => [group.decade, group.changes.map(entry => entry.index)])).toEqual([
        ['1860s', [0, 1]],
        ['1930s', [2, 3]],
        ['Plan', [4]],
      ]);
    });
  });

  describe('findChanges', () => {
    test('finds the changes holding every word typed, in their title, what they name or their year, accents and case aside', () => {
      const changes = [
        { ...change(0, 1968), title: 'Victoria line opens', subtitle: 'Walthamstow Central – Highbury & Islington' },
        { ...change(1, 1969), title: 'Victoria line extended', subtitle: 'Warren Street – Victoria' },
        { ...change(2, 1990), title: 'Náměstí Míru renamed', subtitle: 'now Náměstí Míru' },
        change(3, null),
      ];
      expect(findChanges(changes, 'victoria 1968').map(found => found.index)).toEqual([0]);
      expect(findChanges(changes, '  VICTORIA ').map(found => found.index)).toEqual([0, 1]);
      expect(findChanges(changes, 'namesti miru').map(found => found.index)).toEqual([2]);
      expect(findChanges(changes, 'plan').map(found => found.index)).toEqual([3]);
      expect(findChanges(changes, '')).toBe(changes);
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

    test('is none in a plan', () => {
      expect(currentChangeIndex(CHANGES, timeAt({ inPlan: true, cursor: 5 }), false)).toBeNull();
    });
  });

  describe('changeState', () => {
    test('marks the changes the map has passed done, and the current one active', () => {
      expect([4, 5, 6].map(index => changeState(index, 5))).toEqual(['completed', 'active', undefined]);
    });

    test('marks a change done though the current one is not in the list searched', () => {
      expect([1, 3, 5].map(index => changeState(index, 4))).toEqual(['completed', 'completed', undefined]);
    });

    test('marks none with no current change', () => {
      expect(changeState(1, null)).toBeUndefined();
    });
  });

  describe('changeRows', () => {
    test('puts each decade’s heading over its first change, the last of each with no line on', () => {
      const rows = changeRows(changesByDecade(CHANGES));
      expect(rows.map(row => [row.change.index, row.heading ? row.decade : null, row.last])).toEqual([
        [0, '1860s', false],
        [1, null, true],
        [2, '1930s', false],
        [3, null, true],
        [4, 'Plan', true],
      ]);
      expect(new Set(rows.map(row => row.key)).size).toBe(rows.length);
    });
  });
});
