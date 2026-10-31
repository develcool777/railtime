import type { CityBoundary } from '@railtime/schema/boundary.types';
import type { LngLat } from '@railtime/schema/network.types';
import { describe, expect, test } from 'vitest';
import { CoverageGrid } from '../../../src/coverage/grid.service';

/** Degrees of longitude and latitude in a km, at 51.5° north. */
const KM_EAST = 0.0144;
const KM_NORTH = 1 / 110.57;

/**
 * A square ring, `size` km a side, its south-west corner `east` and `north` km from 0°, 51.5°.
 *
 * @param size - Its side, km.
 * @param east - Km east of 0°.
 * @param north - Km north of 51.5°.
 * @returns The ring, closed.
 */
const square = (size: number, east = 0, north = 0): LngLat[] => {
  const [west, south] = [east * KM_EAST, 51.5 + north * KM_NORTH];
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

describe('CoverageGrid', () => {
  test('cuts a city into cells of 100 m at the finest, and knows its area', () => {
    const grid = new CoverageGrid(cityOf([square(2)]));
    expect([grid.columns, grid.rows]).toEqual([20, 20]);
    expect(grid.km2).toBeCloseTo(4, 1);
    expect(grid.inside.every(cell => cell === 1)).toBe(true);
    expect(grid.corners[0]).toEqual([0, 51.5 + 2 * KM_NORTH]);
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
    const distances = grid.distances(
      [
        [1 * KM_EAST, 51.5 + 1 * KM_NORTH],
        [0, 51.5],
      ],
      500,
    );
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
});
