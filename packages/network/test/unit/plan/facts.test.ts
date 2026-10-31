import { describe, expect, test } from 'vitest';
import { planFacts } from '../../../src/plan/facts.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';

describe('FactsUtils', () => {
  describe('planFacts', () => {
    test('counts the stations and track a plan adds, and the lines it builds', () => {
      const facts = planFacts(planOnlyNetwork(), 'first');
      expect(facts.stations).toBe(3);
      // A–B is 0.01° of longitude at 50° N, B–C a little more: about 2 km in all.
      expect(facts.km).toBeGreaterThan(1.8);
      expect(facts.km).toBeLessThan(2.2);
      expect(facts.lines).toEqual([{ id: 'red', name: 'Red', color: '#ff0000', darkColor: '#ff0000' }]);
    });
  });
});
