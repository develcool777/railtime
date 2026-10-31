import type { Section, SheetSnap } from '~/features/explorer/explorer.types';

/** The panel's sections, in the rail's order, each with its icon. Plans shows only for a city with plans. */
export const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'lines', label: 'Lines', icon: 'i-lucide-list' },
  { id: 'stations', label: 'Stations', icon: 'i-lucide-map-pin' },
  { id: 'changes', label: 'Changes', icon: 'i-lucide-history' },
  { id: 'route', label: 'Route', icon: 'i-lucide-route' },
  { id: 'reach', label: 'Reach', icon: 'i-lucide-radar' },
  { id: 'insights', label: 'Insights', icon: 'i-lucide-chart-line' },
  { id: 'plans', label: 'Plans', icon: 'i-lucide-drafting-compass' },
];

/** The panel's width beside the map, pixels: what it opens at, and how far it can be dragged. */
export const PANEL_WIDTH = { initial: 340, min: 280, max: 480 };

/** How tall the phone's sheet stands at each snap, pixels; full stands 8 short of the map's top. */
export const SHEET_HEIGHTS: Record<Exclude<SheetSnap, 'full'>, number> = { peek: 92, half: 420 };

/** Room the phone's sheet leaves above it at full height: the header's, and a little more, pixels. */
export const SHEET_TOP_GAP = 60;

/** Below this width the explorer is the phone's: no rail, the panel a sheet over the map. */
export const PHONE_QUERY = '(width < 64rem)';
