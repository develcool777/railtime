import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat } from '@railtime/core/geometry.types';
import { describe, expect, test } from 'vitest';
import { distanceKm, latitudeOf, mercatorY } from '@railtime/core/geometry.utils';
import { CoverageGrid } from '../../../src/coverage/grid.service';

/** Degrees of longitude and latitude in a km, at 51.5° north. */
const KM_EAST = 0.0144;
const KM_NORTH = 1 / 110.57;
/** Where the test cities start: off the prime meridian, so a west edge of 0° hides no sign. */
const WEST = 2;

/**
 * A point km east and north of 2°, 51.5°.
 *
 * @param east - Km east.
 * @param north - Km north.
 * @returns The point.
 */
const placeAt = (east: number, north: number): LngLat => [WEST + east * KM_EAST, 51.5 + north * KM_NORTH];

/**
 * A square ring, `size` km a side, its south-west corner `east` and `north` km from 2°, 51.5°.
 *
 * @param size - Its side, km.
 * @param east - Km east of 2°.
 * @param north - Km north of 51.5°.
 * @returns The ring, closed.
 */
const square = (size: number, east = 0, north = 0): LngLat[] => {
  const [west, south] = placeAt(east, north);
  const [eastEdge, northEdge] = [west + size * KM_EAST, south + size * KM_NORTH];
  return [
    [west, south],
    [eastEdge, south],
    [eastEdge, northEdge],
    [west, northEdge],
    [west, south],
  ];
};

/**
 * A city of polygons.
 *
 * @param polygons - Its polygons, each its rings.
 * @returns The outline.
 */
const cityOf = (...polygons: LngLat[][][]): CityBoundary => ({ name: 'Test', source: 'test', polygons });

/**
 * Each cell's middle, worked out afresh from the grid's corners: even in longitude, even in Mercator y.
 *
 * @param grid - The grid.
 * @returns The middles, row by row, the first row the northernmost.
 */
const middlesOf = (grid: CoverageGrid): LngLat[] => {
  const [[west, north], , [east, south]] = grid.corners;
  const [northY, southY] = [mercatorY(north), mercatorY(south)];
  return Array.from({ length: grid.rows * grid.columns }, (_, cell) => [
    west + ((cell % grid.columns) + 0.5) * ((east - west) / grid.columns),
    latitudeOf(northY - (Math.floor(cell / grid.columns) + 0.5) * ((northY - southY) / grid.rows)),
  ]);
};

/**
 * Whether a ring holds a point, by counting the edges a ray east of it crosses.
 *
 * @param ring - The ring, closed.
 * @param point - The point.
 * @returns True if it does.
 */
const ringHolds = (ring: LngLat[], [longitude, latitude]: LngLat): boolean =>
  ring.slice(1).reduce((inside, [toX, toY], position) => {
    // Within bounds: the point before, the first being the ring's.
    const [fromX, fromY] = ring[position]!;
    return fromY > latitude !== toY > latitude && longitude < fromX + ((latitude - fromY) * (toX - fromX)) / (toY - fromY) ? !inside : inside;
  }, false);

/** A city with slanted edges all round and a slanted hole: a kite 4 km across, a triangle cut from it. */
const KITE = cityOf([
  [placeAt(2, 0), placeAt(4, 1.7), placeAt(2.6, 4), placeAt(0, 2.3), placeAt(2, 0)],
  [placeAt(1.2, 1.9), placeAt(2.7, 1.4), placeAt(2.1, 2.9), placeAt(1.2, 1.9)],
]);

describe('CoverageGrid', () => {
  test('cuts a city into cells of 100 m at the finest, and knows its area', () => {
    const grid = new CoverageGrid(cityOf([square(2)]));
    expect([grid.columns, grid.rows]).toEqual([20, 20]);
    expect(grid.km2).toBeCloseTo(4, 1);
    expect(grid.inside.every(cell => cell === 1)).toBe(true);
    expect(grid.corners[0]).toEqual([WEST, 51.5 + 2 * KM_NORTH]);
  });

  test('leaves out a hole, and what lies between two polygons', () => {
    const holed = new CoverageGrid(cityOf([square(2), square(1, 0.5, 0.5)]));
    expect(holed.km2).toBeCloseTo(3, 1);
    const apart = new CoverageGrid(cityOf([square(1)], [square(1, 2, 0)]));
    expect(apart.km2).toBeCloseTo(2, 1);
    // The middle km between them is no one's.
    const middle = Math.floor(apart.rows / 2) * apart.columns + Math.floor(apart.columns / 2);
    expect(apart.inside[middle]).toBe(0);
  });

  test('cuts a big city into coarser cells, so it keeps a bounded count', () => {
    const grid = new CoverageGrid(cityOf([square(100)]));
    expect(grid.columns * grid.rows).toBeLessThanOrEqual(121_000);
    // Degrees of longitude shrink northwards over its 100 km: a little under 10,000 km².
    expect(grid.km2 / 10_000).toBeCloseTo(1, 1);
  });

  test("measures each cell's distance to the nearest point, up to a reach, inside the city only", () => {
    const grid = new CoverageGrid(cityOf([square(2), square(0.4, 0, 0)]));
    // A station at the middle, another at the south-west corner, inside the hole.
    const distances = grid.distances([placeAt(1, 1), placeAt(0, 0)], 500);
    const distanceAt = (east: number, north: number) => distances[Math.floor((2 - north) / 0.1) * grid.columns + Math.floor(east / 0.1)];
    // The cell just north-east of the middle: its centre 71 m away.
    expect(distanceAt(1.05, 1.05)).toBeCloseTo(70.7, -1);
    // 700 m east: beyond the reach.
    expect(distanceAt(1.75, 1.05)).toBe(Infinity);
    // In the hole: outside the city, whatever is near.
    expect(distanceAt(0.05, 0.05)).toBe(Infinity);
    // Beside the hole, nearest the corner station.
    expect(distanceAt(0.45, 0.05)).toBeCloseTo(452, -1);
  });

  test('holds a cell when its middle is inside the outline and out of its holes, slanted edges and all', () => {
    const grid = new CoverageGrid(KITE);
    const [outer = [], hole = []] = KITE.polygons[0]!;
    const expected = middlesOf(grid).map(middle => (ringHolds(outer, middle) && !ringHolds(hole, middle) ? 1 : 0));
    expect([...grid.inside]).toEqual(expected);
    // The kite's 8.18 km² less the hole's 0.98.
    expect(grid.km2).toBeCloseTo(7.2, 1);
  });

  test('measures every cell as one would by hand: stations at the edges, outside the city, and close together', () => {
    const grid = new CoverageGrid(KITE);
    // At the east and west points, past the north one, beyond the west edge, and two 300 m apart, the farther last.
    const stations = [placeAt(4, 1.7), placeAt(0, 2.3), placeAt(2.7, 4.3), placeAt(-0.5, 1), placeAt(2, 0.6), placeAt(2.3, 0.6)];
    const reach = 1200;
    const distances = grid.distances(stations, reach);
    const middles = middlesOf(grid);
    let near = 0;
    for (const [cell, middle] of middles.entries()) {
      const nearest = Math.min(...stations.map(station => distanceKm(station, middle) * 1000));
      // Within bounds: a cell of the grid.
      const distance = distances[cell]!;
      if (!grid.inside[cell] || nearest > reach + 2) expect(distance).toBe(Infinity);
      else if (nearest < reach - 2) {
        expect(distance).toBeCloseTo(nearest, -0.5);
        near++;
      }
    }
    // Enough cells near a station that a slip anywhere would show.
    expect(near).toBeGreaterThan(300);
  });

  test("keeps a station's reach in its own row: one on the east edge reaching past the west one", () => {
    const grid = new CoverageGrid(cityOf([square(1)]));
    const station = placeAt(1, 0.55);
    const distances = grid.distances([station], 2000);
    for (const [cell, middle] of middlesOf(grid).entries()) expect(distances[cell]).toBeCloseTo(distanceKm(station, middle) * 1000, -0.5);
  });

  test('makes a single empty cell of an outline with no polygons', () => {
    const grid = new CoverageGrid(cityOf());
    expect([grid.columns, grid.rows, grid.km2, [...grid.inside]]).toEqual([1, 1, 0, [0]]);
    expect([...grid.distances([placeAt(0, 0)], 1200)]).toEqual([Infinity]);
  });
});
