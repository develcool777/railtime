import type { PlanStatus } from '@railtime/schema/network.types';

import type { ChipTone } from '~/components/ui/statusChip.types';

/** How a plan's card names its status, and the chip's colours. */
export const PLAN_STATUSES: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  'under-construction': { label: 'Under construction', tone: 'amber' },
  planned: { label: 'Planned', tone: 'green' },
  proposed: { label: 'Proposed', tone: 'blue' },
  concept: { label: 'Concept', tone: 'neutral' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
};
