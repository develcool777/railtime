import type { BadgeProps } from '@nuxt/ui';
import type { RouteStrength } from '@railtime/network/facts.types';

/** How a way's card names what it is best at, and the badge's colour: one apart from the other. */
export const ROUTE_STRENGTHS: Record<RouteStrength, { label: string; color: BadgeProps['color'] }> = {
  fastest: { label: 'Fastest', color: 'primary' },
  'fewest-changes': { label: 'Fewest changes', color: 'info' },
};

/** A route's two fields, where it starts and where it ends: what each is for, as its buttons say it. */
export const ROUTE_ENDS = [
  { key: 'from', label: 'where it starts', placeholder: 'From' },
  { key: 'to', label: 'where it ends', placeholder: 'To' },
] as const;
