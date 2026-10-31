import { describe, expect, test } from 'vitest';
import { isAtRest, isDated } from '~/features/explorer/time/time.utils';
import { timeAt } from '@test/support/factories/timeState.utils';

describe('TimeUtils', () => {
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
