import { describe, expect, test } from 'vitest';
import { overlaySubjectOf } from '../../../src/overlay/request.utils';

describe('RequestUtils', () => {
  describe('overlaySubjectOf', () => {
    test('tells overlays apart by what they are of: a route by its ends and preference, a reach by its start', () => {
      const subjects = [
        overlaySubjectOf({ kind: 'route', from: 'a', to: 'b', preference: 'fastest' }),
        overlaySubjectOf({ kind: 'route', from: 'b', to: 'a', preference: 'fastest' }),
        overlaySubjectOf({ kind: 'route', from: 'a', to: 'b', preference: 'fewer-changes' }),
        overlaySubjectOf({ kind: 'reach', from: 'a' }),
        overlaySubjectOf({ kind: 'reach', from: 'b' }),
        overlaySubjectOf({ kind: 'coverage' }),
      ];
      expect(new Set(subjects).size).toBe(subjects.length);
      expect(overlaySubjectOf({ kind: 'reach', from: 'a' })).toBe(overlaySubjectOf({ kind: 'reach', from: 'a' }));
    });

    test('has none for no overlay', () => {
      expect(overlaySubjectOf(null)).toBeNull();
    });
  });
});
