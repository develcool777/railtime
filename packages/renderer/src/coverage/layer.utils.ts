import type { CoverageCells } from '@railtime/network/facts.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
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
 * The city's coverage as an image, a pixel to a cell: each cell in its band's colour, the rest of the
 * city tinted, outside it clear.
 *
 * @param coverage - The city, cell by cell.
 * @returns RGBA pixels, row by row, the first row the northernmost.
 */
export const coverageImage = (coverage: CoverageCells): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(coverage.cells.length * 4);
  const colors = coverage.bands.map(band => [...channelsOf(band.color), COVERAGE_ALPHA]);
  const uncovered = [...channelsOf(UNCOVERED_COLOR), UNCOVERED_ALPHA];
  coverage.cells.forEach((band, cell) => {
    // Outside the city stays clear; past the last band is the city beyond them all.
    if (band >= 0) pixels.set(colors[band] ?? uncovered, cell * 4);
  });
  return pixels;
};

/**
 * What the map draws of a city's coverage: the city shaded by the distance to the nearest station,
 * and its outline.
 *
 * @param coverage - The city, cell by cell, at the moment shown.
 * @param boundary - The city's outline.
 * @returns The drawing.
 */
export const coverageDrawing = (coverage: CoverageCells, boundary: CityBoundary): NonNullable<CoverageDrawing> => ({
  image: { width: coverage.columns, height: coverage.rows, pixels: coverageImage(coverage) },
  corners: coverage.corners,
  outline: boundary.polygons.flat().map(ring => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } })),
});
