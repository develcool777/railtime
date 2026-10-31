import type { PlanStatus } from '@railtime/schema/network.types';

import type { BadgeProps } from '@nuxt/ui';

/** How a plan's card names its status, and the badge's colour. */
export const PLAN_STATUSES: Record<PlanStatus, { label: string; color: BadgeProps['color'] }> = {
  'under-construction': { label: 'Under construction', color: 'warning' },
  planned: { label: 'Planned', color: 'success' },
  proposed: { label: 'Proposed', color: 'info' },
  concept: { label: 'Concept', color: 'neutral' },
  abandoned: { label: 'Abandoned', color: 'neutral' },
};
