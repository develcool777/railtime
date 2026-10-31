import type { LngLat } from '@railtime/schema/network.types';
import type { CoverageBand, CoverageInfo, CoverageYear } from '../facts/facts.types';
import type { NetworkIndex } from '../network/index.service';
import type { Timeline } from '../network/timeline.service';
import type { CoverageGrid } from './grid.service';

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
 * Each cell's band, for a picture: its place among the bands, `bands.length` for the city beyond
 * every band, -1 outside the city.
 *
 * @param grid - The city's grid.
 * @param distances - Each cell's distance to the nearest station.
 * @param bands - The bands, nearest first.
 * @returns A band per cell, row by row from the north.
 */
export const cellBands = (grid: CoverageGrid, distances: Float32Array, bands: CoverageBand[]): Int8Array =>
  Int8Array.from(distances, (metres, cell) => {
    if (!grid.inside[cell]) return -1;
    const band = bandAt(metres, bands);
    return band === -1 ? bands.length : band;
  });

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
