import { describe, expect, test } from 'vitest';
import { fitView, previewOf, projectPoint } from '../../../app/utils/preview.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

const SIZE = { width: 400, height: 200 };

describe('PreviewUtils', () => {
  describe('fitView', () => {
    test('centres the points and zooms until they fill the picture, less its padding', () => {
      const view = fitView(
        [
          [30, 50],
          [30.1, 50],
        ],
        SIZE,
      );
      expect(view.center[0]).toBeCloseTo(30.05, 6);
      expect(view.center[1]).toBeCloseTo(50, 6);
      const [west, east] = [projectPoint(view, SIZE, [30, 50]), projectPoint(view, SIZE, [30.1, 50])];
      // 0.1° across, fitted into 400 px less 16 px either side.
      expect(east[0] - west[0]).toBeCloseTo(368, 3);
      expect(west[1]).toBeCloseTo(100, 3);
    });

    test('stops zooming in on a single point', () => {
      expect(fitView([[30, 50]], SIZE).zoom).toBe(15);
    });
  });

  describe('projectPoint', () => {
    test('puts the centre in the middle, and north up', () => {
      const view = { center: [0, 0] as [number, number], zoom: 2 };
      expect(projectPoint(view, SIZE, [0, 0])).toEqual([200, 100]);
      expect(projectPoint(view, SIZE, [0, 10])[1]).toBeLessThan(100);
    });
  });

  describe('previewOf', () => {
    test("draws a network never built as its first plan, in the plan's colours", () => {
      const preview = previewOf(planOnlyNetwork(), SIZE);
      expect(preview?.paths).toHaveLength(2);
      expect(preview?.paths.every(path => path.color === '#ff0000')).toBe(true);
    });

    test('has nothing to draw for a network with no track', () => {
      expect(previewOf({ ...planOnlyNetwork(), plans: {} }, SIZE)).toBeNull();
    });
  });
});
