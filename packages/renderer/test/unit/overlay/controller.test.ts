import { stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import { overlaySubjectOf } from '../../../src/overlay/controller.service';

describe('ControllerUtils', () => {
  describe('overlaySubjectOf', () => {
    test('tells overlays apart by what they are of: a route by its ends and the way drawn, a reach by its start', () => {
      const subjects = [
        overlaySubjectOf({ kind: 'route', from: stationId('a'), to: stationId('b'), option: 0 }),
        overlaySubjectOf({ kind: 'route', from: stationId('b'), to: stationId('a'), option: 0 }),
        overlaySubjectOf({ kind: 'route', from: stationId('a'), to: stationId('b'), option: 1 }),
        overlaySubjectOf({ kind: 'reach', from: stationId('a') }),
        overlaySubjectOf({ kind: 'reach', from: stationId('b') }),
        overlaySubjectOf({ kind: 'coverage', metres: 800 }),
      ];
      expect(new Set(subjects).size).toBe(subjects.length);
      expect(overlaySubjectOf({ kind: 'reach', from: stationId('a') })).toBe(overlaySubjectOf({ kind: 'reach', from: stationId('a') }));
      // Another distance is the same city: the camera stays where it is.
      expect(overlaySubjectOf({ kind: 'coverage', metres: 400 })).toBe(overlaySubjectOf({ kind: 'coverage', metres: 1200 }));
    });

    test('has none for no overlay', () => {
      expect(overlaySubjectOf(null)).toBeNull();
    });
  });
});
