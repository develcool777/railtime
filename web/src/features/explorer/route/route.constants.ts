import type { RouteStrength } from '@railtime/network/facts.types';
import type { BadgeProps } from '@nuxt/ui';

/** How a way's card names what it is best at, and the badge's colour: one apart from the other. */
export const ROUTE_STRENGTHS: Record<RouteStrength, { label: string; color: BadgeProps['color'] }> = {
  fastest: { label: 'Fastest', color: 'primary' },
  'fewest-changes': { label: 'Fewest changes', color: 'info' },
};
