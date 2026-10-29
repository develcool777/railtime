import type { Network } from '../../../src/network.types';

/**
 * A line A–B open since 1900, with one plan: the line on to a new station C in 2999, and a transfer
 * from C to B.
 *
 * @returns The network.
 */
export const plannedNetwork = (): Network => ({
  meta: { city: 'Test', start: '1899-01-01', built: '2026-01-01', attribution: '' },
  networks: { metro: { name: 'Metro' } },
  lines: { red: { name: 'Red', network: 'metro', mode: 'metro', color: '#ff0000' } },
  stations: { a: { name: 'A', coordinate: [0, 51.5] }, b: { name: 'B', coordinate: [0.01, 51.5] } },
  segments: [
    {
      stationA: 'a',
      stationB: 'b',
      coordinates: [
        [0, 51.5],
        [0.01, 51.5],
      ],
      lines: { red: { open: '1900-01-01' } },
    },
  ],
  plans: {
    extension: {
      name: 'Extension',
      description: 'Red on to C.',
      stations: { c: { name: 'C', coordinate: [0.02, 51.5] } },
      segments: [
        {
          stationA: 'b',
          stationB: 'c',
          coordinates: [
            [0.01, 51.5],
            [0.02, 51.5],
          ],
          lines: { red: { open: '2999-01-01' } },
        },
      ],
      transfers: [{ stationA: 'b', stationB: 'c' }],
    },
  },
});
