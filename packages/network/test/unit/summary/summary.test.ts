import { describe, expect, test } from 'vitest';
import { networkSummary } from '../../../src/summary/summary.utils';
import { planOnlyNetwork } from '../../support/factories/planOnlyNetwork.utils';
import { tinyNetwork } from '../../support/factories/tinyNetwork.utils';

describe('SummaryUtils', () => {
  describe('networkSummary', () => {
    test('sums up a network with a history: its brands, when it opened, its plans, lines and stations', () => {
      expect(networkSummary(tinyNetwork())).toEqual({ networks: ['Metro'], openedYear: 1900, planOnly: false, plans: 1, lines: 4, stations: 4 });
    });

    test('sums up a network never built by its first plan', () => {
      expect(networkSummary(planOnlyNetwork())).toMatchObject({ openedYear: null, planOnly: true, plans: 2, lines: 1, stations: 3 });
    });
  });
});
