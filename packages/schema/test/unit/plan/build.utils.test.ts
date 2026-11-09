import { keysOf } from '@railtime/core/collection.utils';
import { turnDegrees } from '@railtime/core/geometry.utils';
import { byCodeUnits } from '@railtime/core/text.utils';
import { describe, expect, test } from 'vitest';
import { buildPlan } from '../../../src/plan/build.utils';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import { asNetwork, lineId, networkId, planId, stationId } from '../../support/ids.utils';

describe('PlanBuildUtils', () => {
  describe('buildPlan', () => {
    test('says what each section opens, in order, with no dates', () => {
      const { network, sections } = buildPlan(asNetwork(plannedNetwork()), planId('extension'));
      const named = sections.map(section => ({
        ...section,
        segments: section.segments.map(position => `${network.segments[position]!.stationA}-${network.segments[position]!.stationB}`),
      }));
      expect(named).toEqual([
        { line: 'red', infills: ['b'], segments: [] },
        { line: 'red', infills: [], segments: ['c-d'] },
      ]);
    });

    test('stands a new station between two neighbours on their track, split where it is nearest and brought to the station, its dates kept', () => {
      const { network } = buildPlan(asNetwork(plannedNetwork()), planId('extension'));
      expect(network.segments.map(segment => `${segment.stationA}-${segment.stationB}`)).toEqual(['a-b', 'b-c', 'c-d']);
      expect(network.segments[0]).toEqual({
        stationA: 'a',
        stationB: 'b',
        lines: { red: { open: '1900-01-01' } },
        // B stands 111 m north of the track: the track bends to it.
        coordinates: [
          [0, 51.5],
          [0.01, 51.501],
        ],
      });
      expect(network.segments[1]!.coordinates).toEqual([
        [0.01, 51.501],
        [0.02, 51.5],
      ]);
    });

    test("lays new track the plan says nothing of on from its line's track, with none of its lines dated on it", () => {
      const { network } = buildPlan(asNetwork(plannedNetwork()), planId('extension'));
      const [toC, laid] = [network.segments[1]!, network.segments[2]!];
      expect({ ...laid, coordinates: undefined }).toEqual({ stationA: 'c', stationB: 'd', lines: {}, coordinates: undefined });
      expect([laid.coordinates[0], laid.coordinates.at(-1)]).toEqual([
        [0.02, 51.5],
        [0.03, 51.5],
      ]);
      // On from the way the red line comes into C, from B: no corner there.
      expect(turnDegrees(toC.coordinates.at(-2)!, [0.02, 51.5], laid.coordinates[1]!)).toBeLessThan(1);
    });

    test('curves new track the plan says nothing of through its stations, as its trains run, never turning a corner at one', () => {
      const network = asNetwork(plannedNetwork());
      const extension = network.plans![planId('extension')]!;
      // On from D a right angle to the north, to E.
      extension.stations![stationId('e')] = { name: 'E', coordinate: [0.03, 51.509] };
      extension.sections[1] = { line: lineId('red'), stations: [stationId('c'), stationId('d'), stationId('e')] };
      const { network: built } = buildPlan(network, planId('extension'));
      const [toD, toE] = [built.segments.find(segment => segment.stationB === 'd')!, built.segments.find(segment => segment.stationA === 'd')!];
      // Into D and out of it on one heading, a curve either side: over the 80 m round D it bends a few degrees, not the right angle a corner would.
      expect(turnDegrees(toD.coordinates.at(-2)!, [0.03, 51.5], toE.coordinates[1]!)).toBeLessThan(15);
      expect(toD.coordinates.at(-1)).toEqual([0.03, 51.5]);
      expect(toE.coordinates.at(-1)).toEqual([0.03, 51.509]);
    });

    test("lays new track where the plan's track runs, given either way round", () => {
      const network = asNetwork(plannedNetwork());
      const bowed: [number, number][] = [
        [0.03, 51.5],
        [0.025, 51.5003],
        [0.02, 51.5],
      ];
      network.plans![planId('extension')]!.track = [{ stationA: stationId('d'), stationB: stationId('c'), coordinates: bowed }];
      expect(buildPlan(network, planId('extension')).network.segments[2]).toEqual({ stationA: 'c', stationB: 'd', lines: {}, coordinates: bowed.toReversed() });
    });

    test("keeps a section's segments when a later section splits them", () => {
      const network = asNetwork(plannedNetwork());
      network.plans![planId('extension')]!.stations![stationId('e')] = { name: 'E', coordinate: [0.025, 51.5] };
      network.plans![planId('extension')]!.stations![stationId('f')] = { name: 'F', coordinate: [0.04, 51.5] };
      network.plans![planId('extension')]!.sections[1] = { line: lineId('red'), stations: [stationId('c'), stationId('d'), stationId('f')] };
      network.plans![planId('extension')]!.sections.push({ line: lineId('red'), stations: [stationId('c'), stationId('e'), stationId('d')] });
      const built = buildPlan(network, planId('extension'));
      const ends = (position: number) => `${built.network.segments[position]!.stationA}-${built.network.segments[position]!.stationB}`;
      expect(built.sections[1]!.segments.map(ends)).toEqual(['c-e', 'e-d', 'd-f']);
      expect(built.sections[2]).toMatchObject({ infills: ['e'], segments: [] });
    });

    test("adds the plan's lines, stations and transfers to the network's, and drops the plans", () => {
      const { network } = buildPlan(asNetwork(plannedNetwork()), planId('extension'));
      expect(keysOf(network.stations).toSorted(byCodeUnits)).toEqual(['a', 'b', 'c', 'd']);
      expect(network.transfers).toEqual([{ stationA: 'c', stationB: 'd' }]);
      expect(network.plans).toBeUndefined();
      const withTransfers = asNetwork(plannedNetwork());
      withTransfers.transfers = [{ stationA: stationId('a'), stationB: stationId('c') }];
      expect(buildPlan(withTransfers, planId('extension')).network.transfers).toEqual([
        { stationA: 'a', stationB: 'c' },
        { stationA: 'c', stationB: 'd' },
      ]);
      delete withTransfers.plans![planId('extension')]!.transfers;
      expect(buildPlan(withTransfers, planId('extension')).network.transfers).toEqual([{ stationA: 'a', stationB: 'c' }]);
    });

    test('takes the track a line already runs over as it is, whichever way round a section names it', () => {
      const network = asNetwork(plannedNetwork());
      network.plans![planId('extension')]!.sections = [{ line: lineId('red'), stations: [stationId('c'), stationId('a')] }];
      const built = buildPlan(network, planId('extension'));
      expect(built.sections).toEqual([{ line: 'red', infills: [], segments: [] }]);
      expect(built.network.segments).toHaveLength(1);
    });

    test("lays new track for a plan's own line past track it does not run on, splitting nothing, with no transfers where there are none", () => {
      const network = asNetwork(plannedNetwork());
      network.plans![planId('extension')] = {
        name: 'Green',
        status: 'proposed',
        lines: { [lineId('green')]: { name: 'Green', network: networkId('metro'), mode: 'metro', color: '#00aa00' } },
        stations: { [stationId('b')]: { name: 'B', coordinate: [0.01, 51.501] } },
        sections: [{ line: lineId('green'), stations: [stationId('a'), stationId('b'), stationId('c')] }],
      };
      const built = buildPlan(network, planId('extension'));
      const ends = (position: number) => `${built.network.segments[position]!.stationA}-${built.network.segments[position]!.stationB}`;
      expect(built.sections).toMatchObject([{ line: 'green', infills: [] }]);
      expect(built.sections[0]!.segments.map(ends)).toEqual(['a-b', 'b-c']);
      expect(built.network.segments.map((_segment, position) => ends(position))).toEqual(['a-c', 'a-b', 'b-c']);
      expect(built.network).not.toHaveProperty('transfers');
    });

    test('splits nothing where a section reaches its station on track already there, and keeps the other segments of a split', () => {
      const network = asNetwork(plannedNetwork());
      network.plans![planId('extension')]!.lines = { [lineId('green')]: { name: 'Green', network: networkId('metro'), mode: 'metro', color: '#00aa00' } };
      network.plans![planId('extension')]!.sections = [
        { line: lineId('green'), stations: [stationId('d'), stationId('a'), stationId('b')] },
        { line: lineId('red'), stations: [stationId('a'), stationId('b'), stationId('c')] },
      ];
      const built = buildPlan(network, planId('extension'));
      const ends = (position: number) => `${built.network.segments[position]!.stationA}-${built.network.segments[position]!.stationB}`;
      // Red reaches B on green's new track: a–c is not split, and red is laid from B to C.
      expect(built.sections.map(section => section.segments.map(ends))).toEqual([
        ['d-a', 'a-b'],
        ['a-b', 'b-c'],
      ]);
      expect(built.sections[1]!.infills).toEqual([]);
    });

    test('reports the track it lays: nothing for a station splitting track already there, which only bends it to the station', () => {
      const network = asNetwork(plannedNetwork());
      const { laidKm } = buildPlan(network, planId('extension'));
      // C – D alone: 0.01° of longitude at 51.5° north.
      expect(laidKm).toBeCloseTo(0.69, 2);
      network.plans![planId('extension')]!.sections = [{ line: lineId('red'), stations: [stationId('a'), stationId('b'), stationId('c')] }];
      expect(buildPlan(network, planId('extension')).laidKm).toBe(0);
    });

    test('counts new track a later section splits once, however it is cut', () => {
      const network = asNetwork(plannedNetwork());
      const plan = network.plans![planId('extension')]!;
      plan.stations![stationId('e')] = { name: 'E', coordinate: [0.025, 51.5] };
      plan.sections = [
        { line: lineId('red'), stations: [stationId('c'), stationId('d')] },
        { line: lineId('red'), stations: [stationId('c'), stationId('e'), stationId('d')] },
      ];
      expect(buildPlan(network, planId('extension')).laidKm).toBeCloseTo(0.69, 2);
    });

    test('builds nothing for a plan the network does not have, and leaves the network as it was', () => {
      const network = asNetwork(plannedNetwork());
      expect(buildPlan(network, planId('nowhere'))).toEqual({ network: { ...network, plans: undefined }, sections: [], laidKm: 0 });
      buildPlan(network, planId('extension'));
      expect(network.segments).toHaveLength(1);
    });
  });
});
