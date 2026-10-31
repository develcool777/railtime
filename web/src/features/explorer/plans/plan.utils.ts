import type { Section } from '~/features/explorer/explorer.types';

/**
 * The section the panel opens on without a tab in the address: Plans with a plan shown, else Lines.
 *
 * @param plan - The plan shown, if any.
 * @returns The section.
 */
export const openingSectionOf = (plan: string | undefined): Section => (plan ? 'plans' : 'lines');
