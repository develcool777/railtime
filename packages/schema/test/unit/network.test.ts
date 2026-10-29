import { describe, expect, test } from 'vitest';
import { parseNetwork } from '../../src/network.schema';
import type { Network } from '../../src/network.types';
import { plannedNetwork } from '../support/factories/plannedNetwork.utils';

/**
 * The problems the validator reports.
 *
 * @param network - A network.
 * @returns Each problem's message; none for a valid network.
 */
const problemsOf = (network: Network): string[] => {
  try {
    parseNetwork(network);
    return [];
  } catch (error) {
    return (error as { issues: { message: string }[] }).issues.map(issue => issue.message);
  }
};

describe('NetworkSchema', () => {
  test('accepts a network with a plan', () => {
    expect(problemsOf(plannedNetwork())).toEqual([]);
  });

  test("checks a plan's sections against the network and the plan", () => {
    const network = plannedNetwork();
    network.plans!.extension!.sections.push({ line: 'blue', stations: ['d', 'x'] });
    expect(problemsOf(network)).toEqual(['plan extension: section 2: unknown line blue', 'plan extension: section 2: unknown station x']);
  });

  test('refuses a plan reusing an id the network has', () => {
    const network = plannedNetwork();
    network.plans!.extension!.stations!.a = { name: 'Another A', coordinate: [0, 51.6] };
    expect(problemsOf(network)).toEqual(['plan extension: station a is already in the network']);
  });

  test("reports the network's own problems once, not again for each plan", () => {
    const network = plannedNetwork();
    network.transfers = [{ stationA: 'a', stationB: 'nowhere' }];
    expect(problemsOf(network)).toEqual(['transfer a – nowhere: unknown station nowhere']);
  });
});
