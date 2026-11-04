import type { CoverageCells } from '@railtime/network/facts.types';
import type { StationId } from '@railtime/schema/network.types';
import type { OutlineFeature } from '../layers/snapshot.types';

/** How a route marks a stop: one it passes, one where a ride begins (its start, or a change), or its end. */
export type RouteStopKind = 'pass' | 'board' | 'end';

/** A stop on a route, as the map marks it. */
export type RouteStopMark = {
  station: StationId;
  name: string;
  kind: RouteStopKind;
  /** The colour of the line it is on: for a change, the line boarded there. */
  color: string;
};

/** Pixels to draw, row by row, RGBA. */
export type CoverageImage = { width: number; height: number; pixels: Uint8ClampedArray };

/** What the layer draws: the heatmap where it lies, or nothing. */
export type CoverageDrawing = { image: CoverageImage; corners: CoverageCells['corners']; outline: OutlineFeature[] } | null;
