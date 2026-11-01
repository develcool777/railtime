import { describe, expect, test } from 'vitest';
import { overlaySubjectOf } from '../../../src/overlay/controller.service';

describe('ControllerUtils', () => {
  describe('overlaySubjectOf', () => {
    test('tells overlays apart by what they are of: a route by its ends and preference, a reach by its start', () => {
      const subjects = [
        overlaySubjectOf({ kind: 'route', from: 'a', to: 'b', preference: 'fastest' }),
        overlaySubjectOf({ kind: 'route', from: 'b', to: 'a', preference: 'fastest' }),
        overlaySubjectOf({ kind: 'route', from: 'a', to: 'b', preference: 'fewer-changes' }),
        overlaySubjectOf({ kind: 'reach', from: 'a' }),
        overlaySubjectOf({ kind: 'reach', from: 'b' }),
        overlaySubjectOf({ kind: 'coverage', metres: 800 }),
      ];
      expect(new Set(subjects).size).toBe(subjects.length);
      expect(overlaySubjectOf({ kind: 'reach', from: 'a' })).toBe(overlaySubjectOf({ kind: 'reach', from: 'a' }));
      // Another distance is the same city: the camera stays where it is.
      expect(overlaySubjectOf({ kind: 'coverage', metres: 400 })).toBe(overlaySubjectOf({ kind: 'coverage', metres: 1200 }));
    });

    test('has none for no overlay', () => {
      expect(overlaySubjectOf(null)).toBeNull();
    });
  });
});
