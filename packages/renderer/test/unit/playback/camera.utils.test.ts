import { describe, expect, test } from 'vitest';
import { chaseStartOf, followOf, openingOf } from '../../../src/playback/camera.utils';
import { OPENING_MAX_ZOOM, OPENING_SIDE_PADDING } from '../../../src/transitMap.constants';

/**
 * A camera target at a point, facing nowhere in particular.
 *
 * @param point - Where to look from.
 * @returns The target.
 */
const targetAt = (point: [number, number]) => ({ center: point, behind: point, ahead: point });

describe('CameraUtils', () => {
  describe('openingOf', () => {
    const bounds: [[number, number], [number, number]] = [
      [0, 51],
      [1, 52],
    ];

    test('opens on a linked view as it is', () => {
      expect(openingOf({ center: [0.5, 51.5], zoom: 12 }, bounds, { top: 1, bottom: 2, left: 3, right: 4 }, { top: 0, bottom: 0, left: 0, right: 0 })).toEqual({
        center: [0.5, 51.5],
        zoom: 12,
      });
    });

    test('else fits the network clear of the padding above and below, narrow at the sides, and of every panel over the map', () => {
      expect(openingOf(undefined, bounds, { top: 10, bottom: 20, left: 300, right: 300 }, { top: 1, bottom: 2, left: 3, right: 4 })).toEqual({
        bounds,
        fitBoundsOptions: {
          padding: { top: 11, bottom: 22, left: OPENING_SIDE_PADDING + 3, right: OPENING_SIDE_PADDING + 4 },
          maxZoom: OPENING_MAX_ZOOM,
        },
      });
    });
  });

  describe('chaseStartOf', () => {
    test('waits where a change starts, facing the rest of it; a lone station keeps the way it faces', () => {
      expect(chaseStartOf([0, 51], [0, 52], 70)).toEqual({ center: [0, 51], bearing: 0 });
      expect(chaseStartOf([0, 51], [1, 51], 70).bearing).toBeCloseTo(90, 9);
      expect(chaseStartOf([0, 52], [0, 51], 70).bearing).toBeCloseTo(180, 9);
      expect(chaseStartOf([0.5, 51.5], [0.5, 51.5], 70)).toEqual({ center: [0.5, 51.5], bearing: 70 });
    });
  });

  describe('followOf', () => {
    test('sits where the path says, however long the frame', () => {
      const chase = { center: [0, 51] as [number, number], bearing: 0 };
      expect(followOf(chase, targetAt([0, 51.001]), 0.05).center).toEqual([0, 51.001]);
      expect(followOf(chase, targetAt([0, 51.001]), 0.5).center).toEqual([0, 51.001]);
    });

    test('turns, more slowly, the shorter way round to face the way the path goes on, and keeps its way where it goes nowhere', () => {
      const ahead = (to: [number, number]) => ({ center: [0, 51] as [number, number], behind: [0, 51] as [number, number], ahead: to });
      const east = followOf({ center: [0, 51], bearing: 0 }, ahead([1, 51]), 0.1).bearing;
      expect(east).toBeGreaterThan(0);
      expect(east).toBeLessThan(90);
      // Facing 170°, the path due west (270° = -90°): it turns on through 180°, not back through 0°.
      expect(followOf({ center: [0, 51], bearing: 170 }, ahead([-1, 51]), 0.1).bearing).toBeGreaterThan(170);
      expect(followOf({ center: [0, 51], bearing: 33 }, ahead([0, 51]), 0.1)).toEqual({ center: [0, 51], bearing: 33 });
    });
  });
});
