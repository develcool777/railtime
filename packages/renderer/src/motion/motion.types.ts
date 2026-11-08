import type { LngLat } from '@railtime/core/geometry.types';
import type { Palette } from '../layers/theme.types';

/**
 * Something moving on the map this frame, drawn where it is now: a stretch of track it takes up, in
 * its colour, in its line's place across shared track. Given afresh each frame it moves.
 */
export type Mover = {
  /** The stretch it takes up, from its back to its front. */
  path: LngLat[];
  /** `#rrggbb`. */
  color: string;
  /** Its side-by-side slot on shared track, as its line is drawn: …-1, -0.5, 0, 0.5, 1… (`offsetFor`). */
  slot: number;
  /** What it is brought forward or faded with: its line as drawn; `''` for none. */
  group: string;
};

/** A colour of the theme's, by name. */
type PaletteColor = { [Name in keyof Palette]: Palette[Name] extends string ? Name : never }[keyof Palette];

/** A width that changes with zoom, as `byZoom` draws one: pixels at the city's zoom and the street's. */
type ZoomPixels = readonly [number, number];

/**
 * How a kind of mover is drawn: a body edged in its own colour over a soft shadow, all lying on the
 * ground; in 3D, standing up off it, its sides its own colour darkened, its body its roof.
 */
export type MoverStyle = {
  /** The shadow under it, and how soft its edge is. */
  shadowPx: ZoomPixels;
  shadowBlurPx: ZoomPixels;
  /** How solid the shadow is, 0..1. */
  shadowOpacity: number;
  /** Its width, edge to edge of its own colour. */
  casingPx: ZoomPixels;
  /** Its light body within its own colour: its roof in 3D. */
  bodyPx: ZoomPixels;
  /** How far up the screen its roof stands in 3D. */
  risePx: ZoomPixels;
  /** How dark its sides are in 3D: how much of the shadow's colour over its own, 0..1. */
  shade: number;
  /** The theme's colours for its body and its shadow. */
  bodyColor: PaletteColor;
  shadowColor: PaletteColor;
};

/** How the map is seen, as its moving things are drawn for it. */
export type MotionView = {
  zoom: number;
  /** How far the camera is tilted from looking straight down, degrees. */
  pitch: number;
  /** Whether they stand up, as the map is seen in 3D. */
  standing: boolean;
};

/** A colour's red, green and blue, 0..1. */
export type Rgb = [number, number, number];

/**
 * One stroke along every mover of a kind, drawn over the last: how wide, how high up the screen, and
 * in what colour. A mover is its strokes, bottom to top (`passesOf`).
 */
export type StrokePass = {
  widthPx: number;
  /** How soft its edge is, pixels: under one, crisp. */
  blurPx: number;
  /** How far up the screen. */
  risePx: number;
  /** Each mover's own colour, or this one for all. */
  color: Rgb | 'own';
  /** A colour laid over it, and how much: its sides' darkening in 3D. */
  shade: Rgb;
  shadeAmount: number;
  /** How solid, 0..1. */
  opacity: number;
};

/** A mover's vertices among all of its kind's: from which, how many, and the point in their middle, in pixels about the anchor. */
export type VertexRun = { first: number; count: number; middle: readonly [number, number] };

/** The movers' strokes as the shader takes them (`strokeVerticesOf`). */
export type StrokeVertices = {
  /** `STROKE_VERTEX_FLOATS` numbers a vertex. */
  vertices: Float32Array;
  /** Each mover's, in the order given. */
  runs: VertexRun[];
};

/** What a frame draws of one kind of mover: its strokes along its movers, and the order they go in. */
export type StrokeDrawing = {
  vertices: Float32Array;
  /** The runs of vertices, each drawn whole in one draw, in order (`drawOrderOf`). */
  order: VertexRun[];
  passes: StrokePass[];
  /** Pixels a side-by-side slot moves a mover across. */
  slotPx: number;
};
