import { describe, expect, test } from 'vitest';
import { isLineIn, isPlanIn, isStationIn } from '../../../src/validation/ids.utils';
import { plannedNetwork } from '../../support/factories/plannedNetwork.utils';
import { asNetwork } from '../../support/ids.utils';

describe('IdsUtils', () => {
  const network = asNetwork(plannedNetwork());

  describe('isStationIn', () => {
    test("is a station's id there, and nothing else: a line's, a plan's own station's, nor a key every object has", () => {
      expect(isStationIn(network, 'a')).toBe(true);
      expect(isStationIn(network, 'red')).toBe(false);
      expect(isStationIn(network, 'b')).toBe(false);
      expect(isStationIn(network, 'constructor')).toBe(false);
    });
  });

  describe('isLineIn', () => {
    test("is a line's id there, and nothing else", () => {
      expect(isLineIn(network, 'red')).toBe(true);
      expect(isLineIn(network, 'a')).toBe(false);
      expect(isLineIn(network, 'toString')).toBe(false);
    });
  });

  describe('isPlanIn', () => {
    test("is a plan's id there; none of a network without plans", () => {
      expect(isPlanIn(network, 'extension')).toBe(true);
      expect(isPlanIn(network, 'nowhere')).toBe(false);
      const { plans: _plans, ...withoutPlans } = network;
      expect(isPlanIn(withoutPlans, 'extension')).toBe(false);
    });
  });
});
