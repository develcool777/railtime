import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { PlanStatus } from '@railtime/schema/network.types';
import type { ChipTone } from '~/components/ui/statusChip.types';

/** Playback speeds offered. */
export const SPEED_OPTIONS = [1, 2, 4, 8].map(speed => ({ label: `${speed}×`, value: speed }));

/** Default playback speed: London's whole history takes about five and a half minutes. */
export const DEFAULT_SPEED = 2;

/** Camera modes offered during playback. */
export const CAMERA_OPTIONS: { label: string; value: CameraMode }[] = [
  { label: 'Follow', value: 'follow' },
  { label: 'Overview', value: 'overview' },
  { label: 'Free', value: 'free' },
];

/** The share of the timeline a plan's changes take, at its right end. */
export const FUTURE_SHARE = 0.16;

/** How many marks of one year stack on the timeline before they overlap. */
export const MAX_TICK_LEVEL = 3;

/** Years between the labels under the timeline. */
export const TIMELINE_LABEL_YEARS = 25;

/** Changes listed under "Up next" during playback. */
export const UP_NEXT_COUNT = 6;

/** How a plan's card names its status, and the chip's colours. */
export const PLAN_STATUSES: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  'under-construction': { label: 'Under construction', tone: 'amber' },
  planned: { label: 'Planned', tone: 'green' },
  proposed: { label: 'Proposed', tone: 'blue' },
  concept: { label: 'Concept', tone: 'neutral' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
};
