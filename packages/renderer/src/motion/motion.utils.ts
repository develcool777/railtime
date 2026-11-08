import type { LngLat } from '@railtime/core/geometry.types';
import { mercatorY } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import { MAP_TILE_PX, MAX_SIDE_STEPS, SEGMENT_CORNERS, SIDE_OVERLAP, STROKE_VERTEX_FLOATS } from './motion.constants';
import type { MotionView, Mover, MoverStyle, Rgb, StrokePass, StrokeVertices, VertexRun } from './motion.types';
import { atZoom } from '../layers/style.utils';
import type { Palette } from '../layers/theme.types';
import { channelsOf } from '../support/drawing.utils';

/**
 * Where a point is in MapLibre's world: Web Mercator, the whole world 0..1 across and down.
 *
 * @param point - The point.
 * @returns Its x and y.
 */
export const mercatorOf = ([longitude, latitude]: LngLat): [number, number] => [(longitude + 180) / 360, 0.5 - mercatorY(latitude) / (2 * Math.PI)];

/**
 * How many pixels the whole world is across at a zoom: the map's pixels there, Mercator units' worth one each.
 *
 * @param zoom - The zoom.
 * @returns Pixels.
 */
export const worldPixelsAt = (zoom: number): number => MAP_TILE_PX * 2 ** zoom;

/**
 * A colour as a shader takes it.
 *
 * @param hex - `#rrggbb`.
 * @returns Its red, green and blue, 0..1.
 */
export const rgbOf = (hex: string): Rgb => channelsOf(hex).map(channel => channel / 255) as Rgb;

/**
 * How high up a standing mover each stroke of its sides is, from the ground to its roof: each as close
 * to the next as keeps it overlapping the next as the camera, tilted so, sees them, so its sides show
 * whole, and no more of them than that.
 *
 * @param risePx - How high its roof is.
 * @param widthPx - How wide its strokes are.
 * @param pitch - How far the camera is tilted from looking straight down, degrees.
 * @returns The heights, from the ground's up to the roof's.
 */
export const sideHeightsOf = (risePx: number, widthPx: number, pitch: number): number[] => {
  const seenWidth = widthPx * Math.cos((pitch * Math.PI) / 180) * SIDE_OVERLAP;
  const steps = Math.min(Math.max(Math.ceil(risePx / Math.max(seenWidth, Number.EPSILON)), 2), MAX_SIDE_STEPS);
  return Array.from({ length: steps + 1 }, (_unused, step) => (risePx * step) / steps);
};

/**
 * The strokes a kind of mover is drawn with as the map is seen, bottom to top: its shadow, its own
 * colour, and its light body. Standing in 3D, its own colour is its sides, darkened, from the ground
 * up to a rim at its roof (`sideHeightsOf`), which its body tops.
 *
 * @param style - How the kind is drawn.
 * @param palette - The theme's colours.
 * @param view - How the map is seen.
 * @returns Its strokes.
 */
export const passesOf = (style: MoverStyle, palette: Palette, { zoom, pitch, standing }: MotionView): StrokePass[] => {
  const shadow = rgbOf(palette[style.shadowColor]);
  const casing = atZoom(style.casingPx, zoom);
  const rise = standing ? atZoom(style.risePx, zoom) : 0;
  const own = { widthPx: casing, blurPx: 0, color: 'own', shade: shadow, opacity: 1 } as const;
  const heights = standing ? sideHeightsOf(rise, casing, pitch) : [0];
  return [
    {
      widthPx: atZoom(style.shadowPx, zoom),
      blurPx: atZoom(style.shadowBlurPx, zoom),
      risePx: 0,
      color: shadow,
      shade: shadow,
      shadeAmount: 0,
      opacity: style.shadowOpacity,
    },
    ...heights.map((height, step) => ({ ...own, risePx: height, shadeAmount: standing && step < heights.length - 1 ? style.shade : 0 })),
    { widthPx: atZoom(style.bodyPx, zoom), blurPx: 0, risePx: rise, color: rgbOf(palette[style.bodyColor]), shade: shadow, shadeAmount: 0, opacity: 1 },
  ];
};

/**
 * The movers' strokes as the shader takes them: two triangles for each segment of each one's path, in
 * pixels of the map's zoom about an anchor near them all, so the numbers stay small enough for 32
 * bits to place them within a fraction of a pixel, and a stroke's width is the pixels MapLibre draws a
 * line in; and where each mover's are among them.
 *
 * @param movers - The movers.
 * @param anchor - The anchor, in Mercator units (`mercatorOf`).
 * @param worldPixels - The whole world across at the map's zoom (`worldPixelsAt`).
 * @returns `STROKE_VERTEX_FLOATS` numbers a vertex, and each mover's vertices.
 */
export const strokeVerticesOf = (movers: readonly Mover[], anchor: readonly [number, number], worldPixels: number): StrokeVertices => {
  let segments = 0;
  for (const { path } of movers) segments += Math.max(path.length - 1, 0);
  const vertices = new Float32Array(segments * SEGMENT_CORNERS.length * STROKE_VERTEX_FLOATS);
  const runs: VertexRun[] = [];
  let filled = 0;
  for (const { path, color, slot } of movers) {
    const [red, green, blue] = rgbOf(color);
    const points = path.map(point => {
      const [x, y] = mercatorOf(point);
      return [(x - anchor[0]) * worldPixels, (y - anchor[1]) * worldPixels] as const;
    });
    const segmentsOf = points.slice(1).map((to, place) => [required(points[place], 'the point before'), to] as const);
    const first = filled / STROKE_VERTEX_FLOATS;
    for (const [from, to] of segmentsOf)
      for (const [along, across] of SEGMENT_CORNERS) {
        // Each number in its place, no array made for them: this runs for every vertex of every mover, every frame.
        vertices[filled] = from[0];
        vertices[filled + 1] = from[1];
        vertices[filled + 2] = to[0];
        vertices[filled + 3] = to[1];
        vertices[filled + 4] = along;
        vertices[filled + 5] = across;
        vertices[filled + 6] = red;
        vertices[filled + 7] = green;
        vertices[filled + 8] = blue;
        vertices[filled + 9] = slot;
        filled += STROKE_VERTEX_FLOATS;
      }
    const middle = points[Math.floor(points.length / 2)];
    if (middle && segmentsOf.length > 0) runs.push({ first, count: filled / STROKE_VERTEX_FLOATS - first, middle });
  }
  return { vertices, runs };
};

/**
 * The order the movers are drawn in, each whole, all its strokes in one draw. Lying flat, they are
 * one: each stroke of every mover over the last, as the map draws its lines. Standing in 3D, each its
 * own, the furthest from the camera first, so the nearer stands in front: their sides overlap where
 * they pass close, and only the order says which is in front.
 *
 * @param vertices - The movers' strokes.
 * @param matrix - The projection about their anchor (`anchoredMatrix`).
 * @param standing - Whether they stand.
 * @returns The runs of vertices to draw, in order.
 */
export const drawOrderOf = ({ vertices, runs }: StrokeVertices, matrix: ArrayLike<number>, standing: boolean): VertexRun[] => {
  if (!standing) return vertices.length === 0 ? [] : [{ first: 0, count: vertices.length / STROKE_VERTEX_FLOATS, middle: [0, 0] }];
  /**
   * How far from the camera a point is: its projected `w`.
   *
   * @param point - The point, in pixels about the anchor.
   * @returns The distance, in the projection's units.
   */
  const distance = ([x, y]: readonly [number, number]): number => (matrix[3] ?? 0) * x + (matrix[7] ?? 0) * y + (matrix[15] ?? 0);
  return runs.toSorted((first, second) => distance(second.middle) - distance(first.middle));
};

/**
 * A projection that takes the strokes' pixels about their anchor: the map's own, from the whole
 * world's Mercator units, its height in the same, scaled to the map's pixels and moved to the anchor
 * in 64 bits, before the shader's 32 bits take it.
 *
 * @param matrix - The map's projection, column by column.
 * @param anchor - The anchor, in Mercator units.
 * @param worldPixels - The whole world across at the map's zoom.
 * @returns The projection.
 */
export const anchoredMatrix = (matrix: ArrayLike<number>, anchor: readonly [number, number], worldPixels: number): Float32Array => {
  const anchored = new Float32Array(16);
  const [x, y] = anchor;
  for (const row of [0, 1, 2, 3]) {
    anchored[row] = (matrix[row] ?? 0) / worldPixels;
    anchored[4 + row] = (matrix[4 + row] ?? 0) / worldPixels;
    anchored[8 + row] = (matrix[8 + row] ?? 0) / worldPixels;
    anchored[12 + row] = (matrix[row] ?? 0) * x + (matrix[4 + row] ?? 0) * y + (matrix[12 + row] ?? 0);
  }
  return anchored;
};
