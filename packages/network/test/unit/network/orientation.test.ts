import type { LngLat } from '@railtime/core/geometry.types';
import { describe, expect, test } from 'vitest';
import type { TrackSegment, Travel } from '../../../src/network/engine.types';
import { NetworkIndex } from '../../../src/network/index.service';
import { orientSegments } from '../../../src/network/orientation.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

/** Where made-up stations stand: east (x) and north (y), in degrees. */
const PLACES: Record<string, LngLat> = {
  a: [0, 0],
  b: [1, 0],
  c: [2, 0],
  d: [3, 0],
  x: [1, 1],
  p: [5, 5],
  q: [4, 5],
};

/**
 * A straight segment between two made-up stations, its points stored from the first given.
 *
 * @param index - Its id.
 * @param stationA - Where its points start.
 * @param stationB - Where they end.
 * @returns The segment.
 */
const track = (index: number, stationA: string, stationB: string): TrackSegment => {
  const coordinates = [PLACES[stationA]!, PLACES[stationB]!];
  return {
    index,
    stationA,
    stationB,
    coordinates,
    reversedCoordinates: [...coordinates].reverse(),
    distances: [0, 1],
    reversedDistances: [0, 1],
    lengthKm: 1,
    travel: 1,
  };
};

/**
 * Where a segment starts and ends, travelled as oriented.
 *
 * @param segment - The segment.
 * @param travel - Its direction.
 * @returns Its first and last station.
 */
const ends = (segment: TrackSegment, travel: Travel | undefined): [string, string] =>
  travel === 1 ? [segment.stationA, segment.stationB] : [segment.stationB, segment.stationA];

describe('OrientationUtils', () => {
  test('runs a line through each station: one segment ends where the next starts', () => {
    const index = new NetworkIndex(tinyNetwork());
    const [first, second, third] = index.segments;
    const endOf = (segment = first!) => (segment.travel === 1 ? segment.stationB : segment.stationA);
    const startOf = (segment = first!) => (segment.travel === 1 ? segment.stationA : segment.stationB);
    expect(endOf(first)).toBe(startOf(second));
    expect(endOf(second)).toBe(startOf(third));
  });

  test('runs a line stored in mixed directions end to end, heading east', () => {
    const segments = [track(0, 'b', 'c'), track(1, 'b', 'a'), track(2, 'd', 'c')];
    const travel = orientSegments(segments);
    expect(segments.map(segment => ends(segment, travel.get(segment)))).toEqual([
      ['b', 'c'],
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('carries a branch on from the junction where the line arrives', () => {
    const segments = [track(0, 'b', 'a'), track(1, 'c', 'b'), track(2, 'x', 'b')];
    const travel = orientSegments(segments);
    expect(segments.map(segment => ends(segment, travel.get(segment)))).toEqual([
      ['a', 'b'],
      ['b', 'c'],
      ['b', 'x'],
    ]);
  });

  test('runs a ring with no junction all the way round, and heads each separate piece east', () => {
    const ring = [track(0, 'a', 'b'), track(1, 'c', 'b'), track(2, 'c', 'x'), track(3, 'a', 'x')];
    const apart = track(4, 'p', 'q');
    const travel = orientSegments([...ring, apart]);
    const legs = ring.map(segment => ends(segment, travel.get(segment)));
    for (const [position, [, end]] of legs.entries()) expect(legs[(position + 1) % legs.length]?.[0]).toBe(end);
    expect(ends(apart, travel.get(apart))).toEqual(['q', 'p']);
  });
});
