import type { Network } from '@railtime/schema/network.types';
import { NetworkModel } from '../../src/model/network.service';
import type { NetworkAt } from '../../src/model/network.types';

/** Today, for every model in the tests: 1 January 2026. */
const TEST_TODAY = Date.UTC(2026, 0, 1);

/**
 * A network's model, today 1 January 2026.
 *
 * @param network - The network.
 * @param plan - One of its plans to build on it.
 * @returns The model.
 */
export const modelOf = (network: Network, plan?: string): NetworkModel => NetworkModel.create(network, { ...(plan ? { plan } : {}), today: TEST_TODAY });

/**
 * The network's questions answered at the end of a day, or in its future (every change played), in
 * the light theme's colours.
 *
 * @param model - The model.
 * @param when - A timestamp, or `future`.
 * @returns The questions, answered then.
 */
export const questionsOn = (model: NetworkModel, when: number | 'future'): NetworkAt =>
  when === 'future'
    ? model.asOf({ cursor: model.timeline.steps.length, time: model.range.end }, 'light')
    : model.asOf({ cursor: model.timeline.cursorAt(when), time: when }, 'light');
