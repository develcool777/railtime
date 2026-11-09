import type { StationId } from '@railtime/schema/network.types';
import { lineId, stationId } from '@railtime/schema/testing/ids';
import { describe, expect, test } from 'vitest';
import type { LineSegment, TrackSegment } from '../../../src/engine/engine.types';
import { engineOf } from '../../../src/engine/engine.utils';
import { forkedParts, linesByStation, planGrowth } from '../../../src/engine/timeline.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';
import { factsOf } from '../../support/facts.utils';

/**
 * A segment of a made-up stretch, as long as given: growth reads only its ends and length.
 *
 * @param index - Its id.
 * @param stationA - One end.
 * @param stationB - The other.
 * @param lengthKm - Its length.
 * @returns The segment.
 */
const track = (index: number, stationA: StationId, stationB: StationId, lengthKm: number): TrackSegment => ({
  index,
  stationA,
  stationB,
  coordinates: [],
  reversedCoordinates: [],
  distances: [],
  reversedDistances: [],
  tracks: [],
  lengthKm,
  travel: 1,
});
/**
 * A line's period on a made-up segment: what splitting a stretch reads is its track.
 *
 * @param segment - The segment.
 * @returns The line segment.
 */
const onLine = (segment: TrackSegment): LineSegment => ({ segment, line: lineId('red'), opens: 0, closes: null, section: null, previous: null, next: null });

describe('TimelineUtils', () => {
  describe('linesByStation', () => {
    test('groups changes by station, each station first met first, its lines in the order given', () => {
      const changes = [
        { station: stationId('b'), line: lineId('red') },
        { station: stationId('a'), line: lineId('blue') },
        { station: stationId('b'), line: lineId('pink') },
      ];
      expect([...linesByStation(changes)]).toEqual([
        ['b', ['red', 'pink']],
        ['a', ['blue']],
      ]);
    });
  });

  describe('planGrowth', () => {
    test('grows out of stations already on the map, reaching new ones in order', () => {
      const { index } = engineOf(factsOf(tinyNetwork()));
      const growth = planGrowth(index.segments.slice(1), new Set([stationId('a'), stationId('b')]), station => index.coordOf(station), index.centre);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['b', false],
        ['c', true],
        ['d', true],
      ]);
      expect(growth.totalKm).toBeCloseTo(2, 0);
    });

    test('grows an extension out of its own line, though its other end meets another line nearer the centre', () => {
      // West on the line extended, East on another line only; the centre by East.
      const segments = [track(0, stationId('west'), stationId('middle'), 1), track(1, stationId('middle'), stationId('east'), 1)];
      const placeOf = (station: string): [number, number] => [{ west: 0, middle: 1, east: 2 }[station] ?? 0, 0];
      const growth = planGrowth(segments, new Set([stationId('west'), stationId('east')]), placeOf, [2, 0], new Set([stationId('west')]));
      expect(growth.reach.map(reached => reached.station)).toEqual(['west', 'middle', 'east']);
    });

    test('grows one way between two stations already on the map, from the one nearer the centre', () => {
      // A gap filled: West and East on the map, Middle new between them; the centre by East.
      const segments = [track(0, stationId('west'), stationId('middle'), 1), track(1, stationId('middle'), stationId('east'), 1)];
      const placeOf = (station: string): [number, number] => [{ west: 0, middle: 1, east: 2 }[station] ?? 0, 0];
      const growth = planGrowth(segments, new Set([stationId('west'), stationId('east')]), placeOf, [2, 0]);
      expect(growth.reach.map(reached => reached.station)).toEqual(['east', 'middle', 'west']);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [false, 1],
        [false, 0],
      ]);
      expect(growth.totalKm).toBe(2);
    });

    test('grows a new line crossing the network from its end nearer the centre, through the station they share, not out of it', () => {
      const segments = [track(0, stationId('north'), stationId('cross'), 1), track(1, stationId('cross'), stationId('south'), 1)];
      const placeOf = (station: string): [number, number] => [0, { north: 2, cross: 1, south: 0 }[station] ?? 0];
      const growth = planGrowth(segments, new Set([stationId('cross')]), placeOf, [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.isNew])).toEqual([
        ['south', true],
        ['cross', false],
        ['north', true],
      ]);
    });

    test('grows a fork from its one start, its branches side by side, each segment from its nearer end', () => {
      // Out of O, on the map: Near 1 km, then Far 1 km on and Beyond 3 km on, each listed from its far end.
      const segments = [
        track(0, stationId('o'), stationId('near'), 1),
        track(1, stationId('far'), stationId('near'), 1),
        track(2, stationId('beyond'), stationId('near'), 3),
      ];
      const growth = planGrowth(segments, new Set([stationId('o')]), () => [0, 0], [0, 0]);
      expect(growth.reach).toEqual([
        { station: 'o', km: 0, isNew: false },
        { station: 'near', km: 1, isNew: true },
        { station: 'far', km: 2, isNew: true },
        { station: 'beyond', km: 4, isNew: true },
      ]);
      expect(growth.plans.map(plan => [plan.fromStationA, plan.startKm])).toEqual([
        [true, 0],
        [false, 1],
        [false, 1],
      ]);
      expect(growth.totalKm).toBe(4);
    });

    test('grows a loop, which has no end, from its station on the map, each way round by the shorter', () => {
      // O on the map; P 1 km one way, Q 2 km the other, P–Q 2 km.
      const segments = [track(0, stationId('o'), stationId('p'), 1), track(1, stationId('p'), stationId('q'), 2), track(2, stationId('q'), stationId('o'), 2)];
      const growth = planGrowth(segments, new Set([stationId('o')]), () => [0, 0], [0, 0]);
      expect(growth.reach.map(reached => [reached.station, reached.km])).toEqual([
        ['o', 0],
        ['p', 1],
        ['q', 2],
      ]);
    });

    test('starts a stretch that touches nothing from its end nearest the centre', () => {
      const { index } = engineOf(factsOf(tinyNetwork()));
      const growth = planGrowth(index.segments, new Set(), station => index.coordOf(station), [0.05, 51.5]);
      expect(growth.reach[0]?.station).toBe('d');
    });
  });

  describe('forkedParts', () => {
    test('opens a fork as the longest way from its start, then each branch from where it leaves', () => {
      // Out of O, on the map: Near 1 km, then Far 1 km on and Beyond 3 km on.
      const fork = [
        track(0, stationId('o'), stationId('near'), 1),
        track(1, stationId('far'), stationId('near'), 1),
        track(2, stationId('beyond'), stationId('near'), 3),
      ].map(onLine);
      const parts = forkedParts(fork, new Set([stationId('o')]), () => [0, 0], [0, 0]);
      expect(parts).toEqual([[fork[0], fork[2]], [fork[1]]]);
    });

    test('keeps a stretch with no fork, and a loop, which joins its way twice, in one part', () => {
      const line = [track(0, stationId('o'), stationId('p'), 1), track(1, stationId('p'), stationId('q'), 1)].map(onLine);
      expect(forkedParts(line, new Set([stationId('o')]), () => [0, 0], [0, 0])).toEqual([line]);
      const loop = [track(0, stationId('o'), stationId('p'), 1), track(1, stationId('p'), stationId('q'), 2), track(2, stationId('q'), stationId('o'), 2)].map(
        onLine,
      );
      expect(forkedParts(loop, new Set([stationId('o')]), () => [0, 0], [0, 0])).toHaveLength(1);
    });
  });
});
