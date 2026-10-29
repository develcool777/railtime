import { describe, expect, test } from 'vitest';
import { buildPlan } from '../../src/plan.utils';
import { plannedNetwork } from '../support/factories/plannedNetwork.utils';

describe('PlanUtils', () => {
  describe('buildPlan', () => {
    test('says what each section opens, in order, with no dates', () => {
      const { network, sections } = buildPlan(plannedNetwork(), 'extension');
      const named = sections.map(section => ({
        ...section,
        segments: section.segments.map(position => `${network.segments[position]!.stationA}-${network.segments[position]!.stationB}`),
      }));
      expect(named).toEqual([
        { line: 'red', infills: ['b'], segments: [] },
        { line: 'red', infills: [], segments: ['c-d'] },
      ]);
    });

    test('stands a new station between two neighbours on their track, splitting it where it is nearest, its dates kept', () => {
      const { network } = buildPlan(plannedNetwork(), 'extension');
      expect(network.segments.map(segment => `${segment.stationA}-${segment.stationB}`)).toEqual(['a-b', 'b-c', 'c-d']);
      expect(network.segments[0]).toEqual({
        stationA: 'a',
        stationB: 'b',
        lines: { red: { open: '1900-01-01' } },
        coordinates: [
          [0, 51.5],
          [0.01, 51.5],
        ],
      });
      expect(network.segments[1]!.coordinates).toEqual([
        [0.01, 51.5],
        [0.02, 51.5],
      ]);
    });

    test('lays new track straight, with none of its lines dated on it', () => {
      const { network } = buildPlan(plannedNetwork(), 'extension');
      expect(network.segments[2]).toEqual({
        stationA: 'c',
        stationB: 'd',
        lines: {},
        coordinates: [
          [0.02, 51.5],
          [0.03, 51.5],
        ],
      });
    });

    test("keeps a section's segments when a later section splits them", () => {
      const network = plannedNetwork();
      network.plans!.extension!.stations!.e = { name: 'E', coordinate: [0.025, 51.5] };
      network.plans!.extension!.sections.push({ line: 'red', stations: ['c', 'e', 'd'] });
      const built = buildPlan(network, 'extension');
      const ends = (position: number) => `${built.network.segments[position]!.stationA}-${built.network.segments[position]!.stationB}`;
      expect(built.sections[1]!.segments.map(ends)).toEqual(['c-e', 'e-d']);
      expect(built.sections[2]).toMatchObject({ infills: ['e'], segments: [] });
    });

    test("adds the plan's lines, stations and transfers, and drops the plans", () => {
      const { network } = buildPlan(plannedNetwork(), 'extension');
      expect(Object.keys(network.stations).sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(network.transfers).toEqual([{ stationA: 'c', stationB: 'd' }]);
      expect(network.plans).toBeUndefined();
    });

    test('builds nothing for a plan the network does not have, and leaves the network as it was', () => {
      const network = plannedNetwork();
      expect(buildPlan(network, 'nowhere')).toEqual({ network: { ...network, plans: undefined }, sections: [] });
      buildPlan(network, 'extension');
      expect(network.segments).toHaveLength(1);
    });
  });
});
