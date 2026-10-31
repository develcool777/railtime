import type { LngLat } from '@railtime/schema/network.types';
import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';
import type { CoverageBand, CoverageInfo, CoverageYear } from '../transitMap.types';
import type { CoverageGrid } from './grid.service';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA, UNCOVERED_COLOR } from './layer.constants';

/**
 * Where the stations a line calls at stand, at a cursor: a station the track passes but no train
 * stops at serves no one.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param cursor - The cursor.
 * @returns Their coordinates.
 */
export const servedStations = (index: NetworkIndex, timeline: Timeline, cursor: number): LngLat[] =>
  [...timeline.stationsOnMap(cursor)]
    .filter(station =>
      index.lineSegmentsAt(station).some(lineSegment => timeline.isOpen(lineSegment, cursor) && timeline.servesStation(station, lineSegment.line, cursor)),
    )
    .map(station => index.coordOf(station));

/**
 * The band a distance falls in.
 *
 * @param metres - The distance.
 * @param bands - The bands, nearest first.
 * @returns Its place among them, or -1 beyond them all.
 */
export const bandAt = (metres: number, bands: CoverageBand[]): number => bands.findIndex(band => metres <= band.upTo);

/**
 * How much of the city lies in each band, and within the headline distance.
 *
 * @param grid - The city's grid.
 * @param distances - Each cell's distance to the nearest station, `grid.distances` gave.
 * @param bands - The bands, nearest first.
 * @param metres - The headline distance: the farthest band's that it is the end of.
 * @returns The coverage, its outline's name and source left blank.
 */
export const coverageOf = (grid: CoverageGrid, distances: Float32Array, bands: CoverageBand[], metres: number): Omit<CoverageInfo, 'name' | 'source'> => {
  const km2 = bands.map(() => 0);
  let beyond = 0;
  for (let cell = 0; cell < distances.length; cell++) {
    if (!grid.inside[cell]) continue;
    // Within bounds: the loop's.
    const band = bandAt(distances[cell]!, bands);
    if (band === -1) beyond += grid.cellKm2(cell);
    else km2[band]! += grid.cellKm2(cell);
  }
  const share = (area: number) => (grid.km2 > 0 ? area / grid.km2 : 0);
  const within = bands.reduce((total, band, position) => (band.upTo <= metres ? total + km2[position]! : total), 0);
  return {
    km2: grid.km2,
    metres,
    share: share(within),
    bands: bands.map((band, position) => ({ ...band, km2: km2[position]!, share: share(km2[position]!) })),
    beyond: { km2: beyond, share: share(beyond) },
  };
};

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
 * The share of the city within the headline distance of a station at the end of each year.
 *
 * @param index - The network.
 * @param timeline - Its timeline.
 * @param grid - The city's grid.
 * @param years - The first and last year.
 * @param metres - The headline distance.
 * @returns A share for each year, oldest first.
 */
export const coverageHistory = (index: NetworkIndex, timeline: Timeline, grid: CoverageGrid, years: [number, number], metres: number): CoverageYear[] => {
  const history: CoverageYear[] = [];
  let lastCursor = -1;
  let share = 0;
  for (let year = years[0]; year <= years[1]; year++) {
    const cursor = timeline.cursorAt(Date.UTC(year, 11, 31));
    // A year with no change keeps the year before's share: the grid is not walked again.
    if (cursor !== lastCursor) {
      const distances = grid.distances(servedStations(index, timeline, cursor), metres);
      let within = 0;
      for (let cell = 0; cell < distances.length; cell++) if (grid.inside[cell] && distances[cell]! <= metres) within += grid.cellKm2(cell);
      share = grid.km2 > 0 ? within / grid.km2 : 0;
      lastCursor = cursor;
    }
    history.push({ year, share });
  }
  return history;
};
