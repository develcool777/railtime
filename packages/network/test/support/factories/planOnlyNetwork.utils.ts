import type { Network } from '@railtime/schema/network.types';

/**
 * A metro never built: no track, two plans. `first` runs a red line A–B–C; `second` a blue line A–D.
 *
 * @returns The network.
 */
export const planOnlyNetwork = (): Network => ({
  meta: { city: 'Test', start: '1980-01-01', built: '2026-01-01', attribution: '' },
  networks: { metro: { name: 'Metro' } },
  lines: {},
  stations: {},
  segments: [],
  plans: {
    first: {
      name: 'First',
      status: 'planned',
      lines: { red: { name: 'Red', network: 'metro', mode: 'metro', color: '#ff0000' } },
      stations: { a: { name: 'A', coordinate: [30, 50] }, b: { name: 'B', coordinate: [30.01, 50] }, c: { name: 'C', coordinate: [30.02, 50.01] } },
      sections: [{ line: 'red', stations: ['a', 'b', 'c'] }],
    },
    second: {
      name: 'Second',
      status: 'abandoned',
      lines: { blue: { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' } },
      stations: { a: { name: 'A', coordinate: [30, 50] }, d: { name: 'D', coordinate: [30, 50.01] } },
      sections: [{ line: 'blue', stations: ['a', 'd'] }],
    },
  },
});
