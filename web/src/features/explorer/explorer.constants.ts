import type { CameraMode } from '@railtime/renderer/transitMap.types';
import type { PlanStatus } from '@railtime/schema/network.types';
import type { ChipTone } from '~/components/ui/statusChip.types';
import type { Section, SheetSnap } from '~/features/explorer/explorer.types';

/** Playback speeds offered. */
export const SPEED_OPTIONS = [1, 2, 4].map(speed => ({ label: `${speed}×`, value: speed }));

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

/** The panel's sections, in the rail's order, each with its icon. Plans shows only for a city with plans. */
export const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'lines', label: 'Lines', icon: 'i-lucide-list' },
  { id: 'changes', label: 'Changes', icon: 'i-lucide-history' },
  { id: 'route', label: 'Route', icon: 'i-lucide-route' },
  { id: 'plans', label: 'Plans', icon: 'i-lucide-drafting-compass' },
];

/** The panel's width beside the map, pixels: what it opens at, and how far it can be dragged. */
export const PANEL_WIDTH = { initial: 340, min: 280, max: 480 };

/** How tall the phone's sheet stands at each snap, pixels; full stands 8 short of the map's top. */
export const SHEET_HEIGHTS: Record<Exclude<SheetSnap, 'full'>, number> = { peek: 92, half: 420 };

/** The phone's sheet, from lowest to highest. */
export const SHEET_SNAPS: SheetSnap[] = ['peek', 'half', 'full'];

/** How far a swipe on the sheet's handle goes before it steps to the next snap, pixels. */
export const SHEET_SWIPE = 30;

/** Below this width the explorer is the phone's: no rail, the panel a sheet over the map. */
export const PHONE_QUERY = '(width < 64rem)';

/** How a plan's card names its status, and the chip's colours. */
export const PLAN_STATUSES: Record<PlanStatus, { label: string; tone: ChipTone }> = {
  'under-construction': { label: 'Under construction', tone: 'amber' },
  planned: { label: 'Planned', tone: 'green' },
  proposed: { label: 'Proposed', tone: 'blue' },
  concept: { label: 'Concept', tone: 'neutral' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
};
