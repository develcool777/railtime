import type { OutlineFeature } from '../layers/features.types';
import type { CoverageCells } from '@railtime/network/facts.types';

/** Pixels to draw, row by row, RGBA. */
export type CoverageImage = { width: number; height: number; pixels: Uint8ClampedArray };

/** What the layer draws: the heatmap where it lies, or nothing. */
export type CoverageDrawing = { image: CoverageImage; corners: CoverageCells['corners']; outline: OutlineFeature[] } | null;
