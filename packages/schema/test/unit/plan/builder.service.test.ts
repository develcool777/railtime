import type { LngLat } from '@railtime/core/geometry.types';
import { describe, expect, test } from 'vitest';
import type { Network, PlanTrack } from '../../../src/format/network.types';
import { PlanBuilder } from '../../../src/plan/builder.service';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import { asNetwork, lineId, planId, stationId } from '../../support/ids.utils';

/** The red line's first section: a new station, B, between A and C on its track. */
const INFILL = { line: lineId('red'), stations: [stationId('a'), stationId('b'), stationId('c')] };

/** Its second: on from C to a new station, D, where there is no track. */
const EXTENSION = { line: lineId('red'), stations: [stationId('c'), stationId('d')] };

/**
 * The planned network with its plan's stations, as a builder starts on it.
 *
 * @returns The network.
 */
const startOf = (): Network => {
  const { plans, ...network } = asNetwork(plannedNetwork());
  return { ...network, stations: { ...network.stations, ...plans?.[planId('extension')]?.stations } };
};

/**
 * The segments of a network, by their stations.
 *
 * @param builder - The builder.
 * @returns Each segment's ends.
 */
const segmentsOf = ({ network }: PlanBuilder): string[] => network.segments.map(({ stationA, stationB }) => `${stationA}-${stationB}`);

describe('PlanBuilder', () => {
  test('stands a new station on the track its line runs over, splitting it there: an infill, laying nothing', () => {
    const builder = new PlanBuilder(startOf());
    builder.build(INFILL);
    expect(segmentsOf(builder)).toEqual(['a-b', 'b-c']);
    expect(builder.sections).toEqual([{ line: lineId('red'), segments: [], infills: [stationId('b')] }]);
    expect(builder.laid.size).toBe(0);
  });

  test('lays track where there is none, and puts the line on it', () => {
    const builder = new PlanBuilder(startOf());
    builder.build(EXTENSION);
    const [laid] = builder.laid;
    expect(segmentsOf(builder)).toEqual(['a-c', 'c-d']);
    expect(builder.sections[0]?.segments).toEqual([laid]);
  });

  test('runs new track where the plan says, between the stations it links', () => {
    const coordinates: LngLat[] = [
      [0.02, 51.5],
      [0.025, 51.502],
      [0.03, 51.5],
    ];
    const track: PlanTrack[] = [{ stationA: stationId('c'), stationB: stationId('d'), coordinates }];
    const builder = new PlanBuilder(startOf(), track);
    builder.build(EXTENSION);
    builder.curve();
    expect([...builder.laid].map(segment => segment.coordinates)).toEqual([coordinates]);
  });

  test("bends the track the plan says nothing of, as its line runs on through a station, its ends on the stations'", () => {
    const builder = new PlanBuilder(startOf());
    builder.build(INFILL);
    builder.build(EXTENSION);
    builder.curve();
    const [laid] = builder.laid;
    expect(laid?.coordinates.length).toBeGreaterThan(2);
    expect([laid?.coordinates[0], laid?.coordinates.at(-1)]).toEqual([
      [0.02, 51.5],
      [0.03, 51.5],
    ]);
  });
});
