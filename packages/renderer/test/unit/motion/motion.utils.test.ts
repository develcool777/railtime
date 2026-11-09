import { describe, expect, test } from 'vitest';
import { atZoom } from '../../../src/layers/style.utils';
import { PALETTES } from '../../../src/layers/theme.constants';
import { TRAIN_STYLE } from '../../../src/layers/trains.constants';
import { MAX_PASSES, MAX_SIDE_STEPS, SEGMENT_CORNERS, SIDE_OVERLAP, STROKE_VERTEX_FLOATS } from '../../../src/motion/motion.constants';
import type { Mover } from '../../../src/motion/motion.types';
import { anchoredMatrix, drawOrderOf, mercatorOf, passesOf, rgbOf, sideHeightsOf, strokeVerticesOf, worldPixelsAt } from '../../../src/motion/motion.utils';

/** A mover of three points, two segments, in red, in the second slot. */
const RED: Mover = {
  path: [
    [0, 0],
    [0.1, 0],
    [0.1, 0.1],
  ],
  color: '#ff0000',
  slot: 0.5,
  group: 'red',
};

/** A mover of one segment, in blue. */
const BLUE: Mover = {
  path: [
    [1, 1],
    [1.1, 1],
  ],
  color: '#0000ff',
  slot: 0,
  group: 'blue',
};

/**
 * Where a point goes under a projection, column by column.
 *
 * @param matrix - The projection.
 * @param point - The point, its x, y and height.
 * @returns Where it goes, its x, y, z and w.
 */
const projected = (matrix: ArrayLike<number>, [x, y, height]: readonly [number, number, number]): number[] =>
  [0, 1, 2, 3].map(row => (matrix[row] ?? 0) * x + (matrix[4 + row] ?? 0) * y + (matrix[8 + row] ?? 0) * height + (matrix[12 + row] ?? 0));

describe('MotionUtils', () => {
  describe('mercatorOf', () => {
    test("places a point in MapLibre's world: 0..1 across from the antimeridian, down from the north", () => {
      expect(mercatorOf([0, 0])).toEqual([0.5, 0.5]);
      expect(mercatorOf([180, 0])).toEqual([1, 0.5]);
      expect(mercatorOf([0, 85.05112878])[1]).toBeCloseTo(0, 6);
    });
  });

  describe('rgbOf', () => {
    test('gives a colour as a shader takes it', () => {
      expect(rgbOf('#ff8000')).toEqual([1, 128 / 255, 0]);
    });
  });

  describe('passesOf', () => {
    test('draws a mover flat: its shadow, its own colour, its light body, as wide as the map draws a line at the zoom', () => {
      const passes = passesOf(TRAIN_STYLE, PALETTES.dark, { zoom: 12, pitch: 0, standing: false });
      expect(passes.map(({ widthPx }) => widthPx)).toEqual([
        atZoom(TRAIN_STYLE.shadowPx, 12),
        atZoom(TRAIN_STYLE.casingPx, 12),
        atZoom(TRAIN_STYLE.bodyPx, 12),
      ]);
      expect(passes.map(({ color }) => color)).toEqual([rgbOf(PALETTES.dark.trainShadow), 'own', rgbOf(PALETTES.dark.trainBody)]);
      expect(passes.map(({ risePx, shadeAmount }) => [risePx, shadeAmount])).toEqual([
        [0, 0],
        [0, 0],
        [0, 0],
      ]);
      expect(passes[0]?.opacity).toBe(TRAIN_STYLE.shadowOpacity);
    });

    test('stands it up in 3D: its own colour darkened up its sides to a rim at its roof, its body the roof', () => {
      const rise = atZoom(TRAIN_STYLE.risePx, 12);
      const heights = sideHeightsOf(rise, atZoom(TRAIN_STYLE.casingPx, 12), 60);
      const passes = passesOf(TRAIN_STYLE, PALETTES.dark, { zoom: 12, pitch: 60, standing: true });
      expect(passes.map(({ risePx }) => risePx)).toEqual([0, ...heights, rise]);
      expect(passes.map(({ shadeAmount }) => shadeAmount)).toEqual([0, ...heights.slice(1).map(() => TRAIN_STYLE.shade), 0, 0]);
      expect(passes.at(-1)?.color).toEqual(rgbOf(PALETTES.dark.trainBody));
    });
  });

  describe('sideHeightsOf', () => {
    test('rises from the ground to the roof in even steps, each closer to the next than the camera sees a stroke wide', () => {
      const seen = (pitch: number) => 14 * Math.cos((pitch * Math.PI) / 180) * SIDE_OVERLAP;
      for (const pitch of [0, 45, 60]) {
        const heights = sideHeightsOf(22, 14, pitch);
        expect([heights[0], heights.at(-1)]).toEqual([0, 22]);
        expect(heights.slice(1).every((height, step) => height - (heights[step] ?? 0) < seen(pitch))).toBe(true);
      }
    });

    test('takes two steps at least, and no more than its most however flat the camera', () => {
      expect(sideHeightsOf(1, 14, 0)).toEqual([0, 0.5, 1]);
      expect(sideHeightsOf(22, 14, 90)).toHaveLength(MAX_SIDE_STEPS + 1);
    });

    test('never asks for more strokes than the shader holds', () => {
      const most = Math.max(...[0, 30, 60, 85, 90].map(pitch => passesOf(TRAIN_STYLE, PALETTES.dark, { zoom: 16, pitch, standing: true }).length));
      expect(most).toBe(MAX_PASSES);
    });
  });

  describe('strokeVerticesOf', () => {
    test("makes two triangles of each segment of each path, in the map's pixels about the anchor, with its colour and slot", () => {
      const anchor = mercatorOf([0, 0]);
      const pixels = worldPixelsAt(10);
      const { vertices, runs } = strokeVerticesOf([RED, BLUE, { ...BLUE, path: [[2, 2]] }], anchor, pixels);
      expect(runs.map(({ first, count }) => [first, count])).toEqual([
        [0, 12],
        [12, 6],
      ]);
      expect(vertices).toHaveLength(3 * SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS);
      const [fromX, fromY] = mercatorOf(RED.path[0]!);
      const [toX, toY] = mercatorOf(RED.path[1]!);
      expect([...vertices.slice(0, STROKE_VERTEX_FLOATS)]).toEqual(
        [(fromX - anchor[0]) * pixels, (fromY - anchor[1]) * pixels, (toX - anchor[0]) * pixels, (toY - anchor[1]) * pixels, 0, -1, 1, 0, 0, 0.5].map(value =>
          Math.fround(value),
        ),
      );
      const last = vertices.slice(-STROKE_VERTEX_FLOATS);
      expect([...last.slice(4, 10)]).toEqual([0, 1, 0, 0, 1, 0]);
    });
  });

  describe('drawOrderOf', () => {
    const strokes = strokeVerticesOf([RED, BLUE], mercatorOf([0.5, 0.5]), worldPixelsAt(10));
    // A camera looking north from the south: the further north, the further from it.
    const lookingNorth = [1, 0, 0, 0, 0, 1, 0, -0.001, 0, 0, 1, 0, 0, 0, 0, 1];

    test('draws every mover lying flat at once, each stroke of all of them over the last', () => {
      expect(drawOrderOf(strokes, lookingNorth, false)).toEqual([{ first: 0, count: 18, middle: [0, 0] }]);
      expect(drawOrderOf({ vertices: new Float32Array(0), runs: [] }, lookingNorth, false)).toEqual([]);
    });

    test('draws each standing mover whole, the furthest from the camera first', () => {
      expect(drawOrderOf(strokes, lookingNorth, true).map(({ first }) => first)).toEqual([12, 0]);
      const lookingSouth = lookingNorth.map((value, place) => (place === 7 ? -value : value));
      expect(drawOrderOf(strokes, lookingSouth, true).map(({ first }) => first)).toEqual([0, 12]);
    });
  });

  describe('worldPixelsAt', () => {
    test("is the whole world across in the map's pixels: a tile at zoom 0, twice as many each zoom in", () => {
      expect([0, 1, 10].map(zoom => worldPixelsAt(zoom))).toEqual([512, 1024, 524_288]);
    });
  });

  describe('anchoredMatrix', () => {
    test("projects a point in the map's pixels about the anchor where the map projects it whole, and a height as one in Mercator units", () => {
      const matrix = [1.5, 0.2, 0.3, 0.1, -0.3, 2, 0.1, 0.2, 0, 0.4, 1, 0.5, 0.4, -0.6, 0, 1];
      const anchor = [0.55, 0.33] as const;
      const point = [0.551, 0.332, 0.00002] as const;
      const pixels = worldPixelsAt(10);
      const about = projected(anchoredMatrix(matrix, anchor, pixels), [(point[0] - anchor[0]) * pixels, (point[1] - anchor[1]) * pixels, point[2] * pixels]);
      expect(about.map(value => value.toFixed(5))).toEqual(projected(matrix, point).map(value => value.toFixed(5)));
    });
  });
});
