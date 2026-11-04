import { checkNetwork } from './checks.utils.ts';
import { checkPlans } from './plans.utils.ts';
import { networkShape } from './shape.schema.ts';
import type { Network } from '../format/network.types';

/** The network's shape, plus the references between its parts and its plans'. */
const networkSchema = networkShape.superRefine((network, context) => {
  const problem = (message: string) => context.addIssue({ code: 'custom', message });
  checkNetwork(network, problem);
  checkPlans(network, problem);
});

/**
 * Validates a dataset: its shape, the references between its parts and its plans', and its dates.
 *
 * @param input - A parsed network JSON.
 * @returns The network, typed.
 * @throws Zod's error, with every problem listed.
 */
export const parseNetwork = (input: unknown): Network => networkSchema.parse(input);
