import type { Network } from '@railtime/schema/network.types';
import { NetworkFacts } from '../../src/facts/facts.service';
import type { FactsAt } from '../../src/facts/facts.types';

/** Today, for every network in the tests: 1 January 2026. */
const TEST_TODAY = Date.UTC(2026, 0, 1);

/**
 * A network's facts, today 1 January 2026.
 *
 * @param network - The network.
 * @param plan - One of its plans to build on it.
 * @returns Its facts.
 */
export const factsOf = (network: Network, plan?: string): NetworkFacts => NetworkFacts.create(network, { ...(plan ? { plan } : {}), today: TEST_TODAY });

/**
 * The network's questions answered at the end of a day, or at its end (every change played, a plan's too).
 *
 * @param facts - The network's facts.
 * @param when - A timestamp, or `end`.
 * @returns The questions, answered then.
 */
export const questionsOn = (facts: NetworkFacts, when: number | 'end'): FactsAt =>
  facts.asOf(when === 'end' ? facts.playheads.end() : facts.playheads.on(when));
