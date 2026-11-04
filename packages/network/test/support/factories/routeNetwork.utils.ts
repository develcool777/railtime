import type { LngLat } from '@railtime/core/geometry.types';
import type { Network } from '@railtime/schema/network.types';
import { asNetwork } from '@railtime/schema/testing/ids';
import type { WrittenSegment } from '@railtime/schema/testing/ids';

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
const segment = (stationA: string, stationB: string, line: string, through: [number, number][]): WrittenSegment => ({
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
 * - apart from them, `grey` runs P–Q–R–S east, and `pink` Q–R a little north of it: off grey and back on
 *
 * @returns The network.
 */
export const routeNetwork = (): Network =>
  asNetwork({
    meta: { city: 'Test', country: 'Testland', start: '1899-01-01', built: '2026-01-01', attribution: '' },
    networks: { metro: { name: 'Metro' } },
    lines: Object.fromEntries(
      ['red', 'blue', 'green', 'yellow', 'grey', 'pink'].map(line => [line, { name: line, network: 'metro', mode: 'metro' as const, color: '#000000' }]),
    ),
    stations: {
      a: { name: 'A', coordinate: pointAt(0, 0) },
      b: { name: 'B', coordinate: pointAt(1, 0) },
      c: { name: 'C', coordinate: pointAt(2, 0) },
      d: { name: 'D', coordinate: pointAt(3, 0) },
      e: { name: 'E', coordinate: pointAt(2, 1) },
      g: { name: 'G', coordinate: pointAt(1, 1) },
      h: { name: 'H', coordinate: pointAt(0, 3) },
      p: { name: 'P', coordinate: pointAt(10, 0) },
      q: { name: 'Q', coordinate: pointAt(11, 0) },
      r: { name: 'R', coordinate: pointAt(12, 0) },
      s: { name: 'S', coordinate: pointAt(13, 0) },
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
      segment('p', 'q', 'grey', [
        [10, 0],
        [11, 0],
      ]),
      segment('q', 'r', 'grey', [
        [11, 0],
        [12, 0],
      ]),
      segment('r', 's', 'grey', [
        [12, 0],
        [13, 0],
      ]),
      segment('q', 'r', 'pink', [
        [11, 0],
        [11.5, 0.3],
        [12, 0],
      ]),
    ],
    transfers: [{ stationA: 'b', stationB: 'g' }],
  });
