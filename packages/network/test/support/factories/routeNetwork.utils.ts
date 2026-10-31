import type { Network, Segment } from '@railtime/schema/network.types';
import type { LngLat } from '@railtime/core/geometry.types';

/**
 * A point `east` km east and `north` km north of A.
 *
 * @param east - Km east.
 * @param north - Km north.
 * @returns The point.
 */
const pointAt = (east: number, north: number): LngLat => [east * 0.0144, 51.5 + north * 0.009];

/**
 * A straight segment of one line, opened in 1900.
 *
 * @param stationA - One end.
 * @param stationB - The other.
 * @param line - Its line.
 * @param through - Points between, km east and north.
 * @returns The segment.
 */
const segment = (stationA: string, stationB: string, line: string, through: [number, number][]): Segment => ({
  stationA,
  stationB,
  coordinates: through.map(([east, north]) => pointAt(east, north)),
  lines: { [line]: { open: '1900-01-01' } },
});

/**
 * A network to find routes on, every line open from 1900, a km between neighbours:
 * - `red` runs A–B–C–D east; `blue` runs C–E north; `green` runs G–E east, a km north of B
 * - B and G are linked by a transfer: a walk
 * - `yellow` runs A–H–E, the long way round, with no change
 *
 * @returns The network.
 */
export const routeNetwork = (): Network => ({
  meta: { city: 'Test', start: '1899-01-01', built: '2026-01-01', attribution: '' },
  networks: { metro: { name: 'Metro' } },
  lines: Object.fromEntries(['red', 'blue', 'green', 'yellow'].map(line => [line, { name: line, network: 'metro', mode: 'metro' as const, color: '#000000' }])),
  stations: {
    a: { name: 'A', coordinate: pointAt(0, 0) },
    b: { name: 'B', coordinate: pointAt(1, 0) },
    c: { name: 'C', coordinate: pointAt(2, 0) },
    d: { name: 'D', coordinate: pointAt(3, 0) },
    e: { name: 'E', coordinate: pointAt(2, 1) },
    g: { name: 'G', coordinate: pointAt(1, 1) },
    h: { name: 'H', coordinate: pointAt(0, 3) },
  },
  segments: [
    segment('a', 'b', 'red', [
      [0, 0],
      [1, 0],
    ]),
    segment('b', 'c', 'red', [
      [1, 0],
      [2, 0],
    ]),
    segment('c', 'd', 'red', [
      [2, 0],
      [3, 0],
    ]),
    segment('c', 'e', 'blue', [
      [2, 0],
      [2, 1],
    ]),
    segment('g', 'e', 'green', [
      [1, 1],
      [2, 1],
    ]),
    segment('a', 'h', 'yellow', [
      [0, 0],
      [0, 3],
    ]),
    segment('h', 'e', 'yellow', [
      [0, 3],
      [2, 1],
    ]),
  ],
  transfers: [{ stationA: 'b', stationB: 'g' }],
});
