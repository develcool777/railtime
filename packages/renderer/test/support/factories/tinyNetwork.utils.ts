import type { LngLat, Network, Segment, Station } from '@railtime/schema/network.types';

/** About 1 km of longitude at 51.5° north, the test line's latitude. */
const ONE_KM = 0.0144;

/**
 * A point on the test line, `position` km east of A.
 *
 * @param position - Km east of A.
 * @returns The point.
 */
const pointAt = (position: number): LngLat => [position * ONE_KM, 51.5];

/**
 * A station on the test line.
 *
 * @param name - Its name.
 * @param position - Km east of A.
 * @returns The station.
 */
const stationAt = (name: string, position: number): Station => ({ name, coordinate: pointAt(position) });

/**
 * A 1 km segment on the test line.
 *
 * @param stationA - Its west end.
 * @param stationB - Its east end.
 * @param position - Km east of A where it starts.
 * @param lines - Its lines and dates.
 * @returns The segment.
 */
const segmentAt = (stationA: string, stationB: string, position: number, lines: Segment['lines']): Segment => ({
  stationA,
  stationB,
  coordinates: [pointAt(position), pointAt(position + 1)],
  lines,
});

/**
 * A tiny line A–B–C–D, 1 km per segment, with one of each kind of step:
 * - `red` opens A–B in 1900 and B–C–D in 1910; C opens on it as an infill station in 1920, but on
 *   `blue` only in 1960, after `blue` had left: `blue` never called there
 * - D, called Old D until 1925, closes on `red` in 1960 while the track stays; A was renamed before it opened
 * - `blue` runs B–C from 1930, is suspended there 1940–1945 and closes it in 1950
 * - `pink` shares A–B, drawn as `red` until 1990
 * - `green` runs C–D from 1970, after D had closed: it passes D by
 * - a transfer between A and D, which opens in 1910
 * - Ukrainian names for the network, `red`, and D now and as Old D; none for the rest
 * - one plan, `extension`: `red` on from D to a new station E in 2030
 *
 * @returns The network.
 */
export const tinyNetwork = (): Network => ({
  meta: { city: 'Test', start: '1899-01-01', built: '2026-01-01', attribution: '' },
  networks: { metro: { name: 'Metro', names: { uk: 'Метро' } } },
  lines: {
    red: { name: 'Red', names: { uk: 'Червона лінія' }, network: 'metro', mode: 'metro', color: '#ff0000' },
    blue: { name: 'Blue', network: 'metro', mode: 'metro', color: '#0000ff' },
    pink: { name: 'Pink', network: 'metro', mode: 'metro', color: '#ff88cc', aliases: [{ until: '1990-01-01', as: 'red', text: 'Pink becomes its own line' }] },
    green: { name: 'Green', network: 'metro', mode: 'metro', color: '#00aa00' },
  },
  stations: {
    a: { ...stationAt('A', 0), formerNames: [{ name: 'Pre A', until: '1899-06-01' }] },
    b: stationAt('B', 1),
    c: { ...stationAt('C', 2), infill: { red: '1920-06-01', blue: '1960-06-01' } },
    d: {
      ...stationAt('D', 3),
      names: { uk: 'Д' },
      closed: { red: '1960-01-01' },
      formerNames: [{ name: 'Old D', names: { uk: 'Старий Д' }, until: '1925-01-01' }],
    },
  },
  segments: [
    segmentAt('a', 'b', 0, { red: { open: '1900-01-01' }, pink: { open: '1900-01-01' } }),
    segmentAt('b', 'c', 1, {
      red: { open: '1910-01-01' },
      blue: { open: '1930-01-01', close: '1950-01-01', suspended: [{ from: '1940-01-01', until: '1945-01-01' }] },
    }),
    segmentAt('c', 'd', 2, { red: { open: '1910-01-01' }, green: { open: '1970-01-01' } }),
  ],
  transfers: [{ stationA: 'a', stationB: 'd' }],
  plans: {
    extension: {
      name: 'Extension',
      description: 'Red on to E.',
      stations: { e: stationAt('E', 4) },
      segments: [segmentAt('d', 'e', 3, { red: { open: '2030-01-01' } })],
    },
  },
});
