import { describe, expect, test } from 'vitest';
import { applyPlan } from '../../src/plan.utils';
import { plannedNetwork } from '../support/factories/plannedNetwork.utils';

describe('PlanUtils', () => {
  describe('applyPlan', () => {
    test("adds the plan's stations, track and transfers, and drops the plans", () => {
      const built = applyPlan(plannedNetwork(), 'extension');
      expect(Object.keys(built.stations)).toEqual(['a', 'b', 'c']);
      expect(built.segments.map(segment => `${segment.stationA}-${segment.stationB}`)).toEqual(['a-b', 'b-c']);
      expect(built.transfers).toEqual([{ stationA: 'b', stationB: 'c' }]);
      expect(built.plans).toBeUndefined();
    });

    test('adds nothing for a plan the network does not have', () => {
      const built = applyPlan(plannedNetwork(), 'nowhere');
      expect(built.segments).toHaveLength(1);
      expect(built.transfers).toBeUndefined();
      expect(built.plans).toBeUndefined();
    });

    test('leaves the network as it was', () => {
      const network = plannedNetwork();
      applyPlan(network, 'extension');
      expect(network.segments).toHaveLength(1);
      expect(Object.keys(network.stations)).toEqual(['a', 'b']);
    });
  });
});
