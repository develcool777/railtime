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

  test("checks a plan's references against the network it would build", () => {
    const network = plannedNetwork();
    network.plans!.extension!.segments!.push({
      stationA: 'c',
      stationB: 'x',
      coordinates: [
        [0.02, 51.5],
        [0.03, 51.5],
      ],
      lines: { blue: { open: '2999-01-01' } },
    });
    expect(problemsOf(network)).toEqual(['plan extension: segment 2: unknown station x', 'plan extension: segment 2: unknown line blue']);
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
