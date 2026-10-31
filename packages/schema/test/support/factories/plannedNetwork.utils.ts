import type { Network } from '../../../src/format/network.types';

/**
 * A line A–C open since 1900, with one plan, `extension`: a new station B between A and C, then the
 * line on to a new station D, with a transfer from D to C.
 *
 * @returns The network.
 */
export const plannedNetwork = (): Network => ({
  meta: { city: 'Test', start: '1899-01-01', built: '2026-01-01', attribution: '' },
  networks: { metro: { name: 'Metro' } },
  lines: { red: { name: 'Red', network: 'metro', mode: 'metro', color: '#ff0000' } },
  stations: { a: { name: 'A', coordinate: [0, 51.5] }, c: { name: 'C', coordinate: [0.02, 51.5] } },
  segments: [
    {
      stationA: 'a',
      stationB: 'c',
      lines: { red: { open: '1900-01-01' } },
      coordinates: [
        [0, 51.5],
        [0.02, 51.5],
      ],
    },
  ],
  plans: {
    extension: {
      name: 'Extension',
      status: 'planned',
      stations: { b: { name: 'B', coordinate: [0.01, 51.501] }, d: { name: 'D', coordinate: [0.03, 51.5] } },
      sections: [
        { line: 'red', stations: ['a', 'b', 'c'] },
        { line: 'red', stations: ['c', 'd'] },
      ],
      transfers: [{ stationA: 'c', stationB: 'd' }],
    },
  },
});
