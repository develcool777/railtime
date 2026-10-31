import { bandAt } from '@railtime/network/coverage.utils';
import type { CoverageMeasure } from '@railtime/network/coverage.service';
import { COVERAGE_BANDS } from '@railtime/network/coverage.constants';
import type { CoverageBand } from '@railtime/network/facts.types';
import type { CoverageGrid } from '@railtime/network/grid.service';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA, UNCOVERED_COLOR } from './layer.constants';
import type { CoverageDrawing } from './layer.types';

/**
 * A colour's red, green and blue.
 *
 * @param hex - `#rrggbb`.
 * @returns Its channels, 0..255.
 */
const channelsOf = (hex: string): [number, number, number] =>
  [1, 3, 5].map(start => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];

/**
 * The grid as an image, a pixel to a cell: each cell in its band's colour, the rest of the city tinted,
 * outside it clear.
 *
 * @param grid - The city's grid.
 * @param distances - Each cell's distance to the nearest station.
 * @param bands - The bands, nearest first.
 * @returns RGBA pixels, row by row, the first row the northernmost.
 */
export const coverageImage = (grid: CoverageGrid, distances: Float32Array, bands: CoverageBand[]): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(distances.length * 4);
  const colors = bands.map(band => [...channelsOf(band.color), COVERAGE_ALPHA]);
  const uncovered = [...channelsOf(UNCOVERED_COLOR), UNCOVERED_ALPHA];
  for (let cell = 0; cell < distances.length; cell++) {
    if (!grid.inside[cell]) continue;
    // Within bounds: the loop's.
    const band = bandAt(distances[cell]!, bands);
    pixels.set(band === -1 ? uncovered : colors[band]!, cell * 4);
  }
  return pixels;
};

/**
 * What the map draws of a city's coverage at a cursor: the city shaded by the distance to the
 * nearest station, and its outline.
 *
 * @param measure - The city's coverage.
 * @param cursor - The timeline's cursor.
 * @returns The drawing.
 */
export const coverageDrawing = (measure: CoverageMeasure, cursor: number): NonNullable<CoverageDrawing> => {
  const { grid, boundary } = measure;
  return {
    image: { width: grid.columns, height: grid.rows, pixels: coverageImage(grid, measure.distances(cursor), COVERAGE_BANDS) },
    corners: grid.corners,
    outline: boundary.polygons.flat().map(ring => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } })),
  };
};
