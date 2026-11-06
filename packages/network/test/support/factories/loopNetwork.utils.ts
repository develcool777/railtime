import type { LngLat } from '@railtime/core/geometry.types';
import type { Network } from '@railtime/schema/network.types';
import { asNetwork } from '@railtime/schema/testing/ids';

/** Where the loop's stations stand: A to the north, B south of it, C east of them. */
const PLACES: Record<string, LngLat> = { a: [0, 51.52], b: [0, 51.5], c: [0.03, 51.51] };

/**
 * A triangle of track, A–B–C, its segments listed from A round by B, three lines round it, each on
 * track of its own, as a circle's two directions are two lines: `clockwise` and `anticlockwise` go that
 * way only, `both` goes both.
 *
 * @returns The network.
 */
export const loopNetwork = (): Network => {
  const round = (line: string) =>
    [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'a'],
    ].map(([stationA, stationB]) => ({
      stationA: stationA!,
      stationB: stationB!,
      coordinates: [PLACES[stationA!]!, PLACES[stationB!]!],
      lines: { [line]: { open: '1900-01-01' } },
    }));
  return asNetwork({
    meta: { city: 'Test', country: 'Testland', start: '1899-01-01', built: '2026-01-01', attribution: '' },
    networks: { metro: { name: 'Metro' } },
    lines: {
      clockwise: { name: 'Clockwise', network: 'metro', mode: 'metro', color: '#ff0000', way: 'clockwise' },
      anticlockwise: { name: 'Anticlockwise', network: 'metro', mode: 'metro', color: '#0000ff', way: 'anticlockwise' },
      both: { name: 'Both', network: 'metro', mode: 'metro', color: '#00aa00' },
    },
    stations: { a: { name: 'A', coordinate: PLACES.a! }, b: { name: 'B', coordinate: PLACES.b! }, c: { name: 'C', coordinate: PLACES.c! } },
    segments: [...round('clockwise'), ...round('anticlockwise'), ...round('both')],
  });
};
