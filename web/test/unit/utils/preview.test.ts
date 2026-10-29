import { describe, expect, test } from 'vitest';
import { fitView, previewOf, projectPoint } from '../../../app/utils/preview.utils';

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
    test("draws each line's track as one path, in its colours and order", () => {
      const preview = previewOf(
        [
          {
            color: '#0000ff',
            darkColor: '#8888ff',
            paths: [
              [
                [30, 50],
                [30, 50.01],
              ],
            ],
          },
          {
            color: '#ff0000',
            darkColor: '#ff0000',
            paths: [
              [
                [30, 50],
                [30.01, 50],
              ],
              [
                [30.01, 50],
                [30.02, 50.01],
              ],
            ],
          },
        ],
        SIZE,
      );
      expect(preview?.paths.map(path => path.color)).toEqual(['#0000ff', '#ff0000']);
      expect(preview?.paths[0]?.darkColor).toBe('#8888ff');
      expect(preview?.paths[1]?.path.match(/M/g)).toHaveLength(2);
    });

    test('has nothing to draw for a network with no track', () => {
      expect(previewOf([], SIZE)).toBeNull();
    });
  });
});
