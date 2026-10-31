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
 * The network's questions answered at the end of a day, or in its future (every change played).
 *
 * @param facts - The network's facts.
 * @param when - A timestamp, or `future`.
 * @returns The questions, answered then.
 */
export const questionsOn = (facts: NetworkFacts, when: number | 'future'): FactsAt =>
  when === 'future'
    ? facts.asOf({ cursor: facts.timeline.steps.length, time: facts.range.end })
    : facts.asOf({ cursor: facts.timeline.cursorAt(when), time: when });
