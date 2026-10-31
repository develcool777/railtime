import type { CityBoundary } from '@railtime/schema/boundary.types';

/** Degrees of longitude in a km, at 51.5° north. */
export const KM_EAST = 0.0144;

/** Degrees of latitude in a km. */
export const KM_NORTH = 1 / 110.57;

/** A 2 km square city, its middle 1 km east and north of 0°, 51.5°, with a station there. */
export const SQUARE: CityBoundary = {
  name: 'Square',
  source: 'test',
  polygons: [
    [
      [
        [0, 51.5],
        [2 * KM_EAST, 51.5],
        [2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [0, 51.5 + 2 * KM_NORTH],
        [0, 51.5],
      ],
    ],
  ],
};

/** The square's middle, where its station stands. */
export const MIDDLE: [number, number] = [KM_EAST, 51.5 + KM_NORTH];

/** The square with a 500 m square hole at its south-west corner. */
export const HOLED: CityBoundary = {
  ...SQUARE,
  polygons: [[...SQUARE.polygons[0]!, SQUARE.polygons[0]![0]!.map(([east, north]) => [east / 4, 51.5 + (north - 51.5) / 4] as [number, number])]],
};

/** A city round the tiny network: A to D, 0 to 3 km east, with 2 km to spare all round. */
export const AROUND_TINY: CityBoundary = {
  name: 'Tiny',
  source: 'test',
  polygons: [
    [
      [
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      ],
    ],
  ],
};

/** A city round the tiny network: A to D, 0 to 3 km east, with 2 km to spare all round, and a hole. */
export const TINY_WITH_HOLE: CityBoundary = {
  name: 'Tiny',
  source: 'test',
  polygons: [
    [
      [
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 - 2 * KM_NORTH],
        [5 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 + 2 * KM_NORTH],
        [-2 * KM_EAST, 51.5 - 2 * KM_NORTH],
      ],
      [
        [3.5 * KM_EAST, 51.5 + KM_NORTH],
        [4.5 * KM_EAST, 51.5 + KM_NORTH],
        [4.5 * KM_EAST, 51.5 + 1.5 * KM_NORTH],
        [3.5 * KM_EAST, 51.5 + KM_NORTH],
      ],
    ],
  ],
};
