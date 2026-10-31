import type { OutlineFeature } from '../layers/features.types';
import type { GridCorners } from '@railtime/network/grid.types';

/** Pixels to draw, row by row, RGBA. */
export type CoverageImage = { width: number; height: number; pixels: Uint8ClampedArray };

/** What the layer draws: the heatmap where it lies, or nothing. */
export type CoverageDrawing = { image: CoverageImage; corners: GridCorners; outline: OutlineFeature[] } | null;
