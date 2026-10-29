import { describe, expect, test } from 'vitest';
import { NetworkIndex } from '../../../src/model/networkIndex.service';
import type { TrackSegment } from '../../../src/model/networkIndex.types';
import { londonNetwork } from '../../support/fixtures/datasets.utils';

const startOf = (segment: TrackSegment) => (segment.travel === 1 ? segment.stationA : segment.stationB);
const endOf = (segment: TrackSegment) => (segment.travel === 1 ? segment.stationB : segment.stationA);

describe('OrientationUtils', () => {
  const index = new NetworkIndex(londonNetwork());
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of index.segments)
    for (const station of [segment.stationA, segment.stationB]) segmentsAt.set(station, [...(segmentsAt.get(station) ?? []), segment]);

  test('runs through every plain station: one segment ends where the next starts', () => {
    const plain = [...segmentsAt.entries()].filter(([, segments]) => segments.length === 2);
    const broken = plain.filter(([station, [first, second]]) => {
      const continues = (from?: TrackSegment, to?: TrackSegment) =>
        from !== undefined && to !== undefined && endOf(from) === station && startOf(to) === station;
      return !continues(first, second) && !continues(second, first);
    });
    expect(plain.length).toBeGreaterThan(200);
    expect(broken.map(([station]) => station)).toEqual([]);
  });

  test('keeps the Circle and District on the same sides from Gloucester Road through South Kensington', () => {
    const between = (from: string, to: string) => {
      const found = index.segments.find(segment => [segment.stationA, segment.stationB].includes(from) && [segment.stationA, segment.stationB].includes(to));
      if (!found) throw new Error(`no segment ${from} – ${to}`);
      return found;
    };
    expect(endOf(between('gloucester-road', 'south-kensington'))).toBe(startOf(between('south-kensington', 'sloane-square')));
  });
});
