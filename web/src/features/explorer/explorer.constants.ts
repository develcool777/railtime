import type { SectionEntry, SheetSnap } from '~/features/explorer/explorer.types';

/** The panel's sections, in the rail's order, each with its icon and what it is for. Plans shows only for a city with plans. */
export const SECTIONS: SectionEntry[] = [
  { id: 'lines', label: 'Lines', icon: 'i-lucide-train-front', description: 'Every line, to show or hide on the map, and each one’s stops and history' },
  { id: 'stations', label: 'Stations', icon: 'i-lucide-circle-dot', description: 'Every station on the map, by name: its lines, and when each came' },
  { id: 'changes', label: 'Changes', icon: 'i-lucide-history', description: 'Every opening and closure, in order: pick one to see the map just after it' },
  { id: 'route', label: 'Route', icon: 'i-lucide-route', description: 'The way between any two stations, on the date shown' },
  { id: 'reach', label: 'Reach', icon: 'i-lucide-radar', description: 'How far you get from a station, by time' },
  { id: 'coverage', label: 'Coverage', icon: 'i-lucide-land-plot', description: 'How much of the city is near a station, and how that grew' },
  { id: 'insights', label: 'Insights', icon: 'i-lucide-chart-line', description: 'How the network grew, decade by decade, and its records' },
  { id: 'plans', label: 'Plans', icon: 'i-lucide-drafting-compass', description: 'What the city has drawn up: show a plan on the map, built' },
];

/** The panel's width beside the map, pixels: what it opens at, and how far it can be dragged. */
export const PANEL_WIDTH = { initial: 340, min: 280, max: 480 };

/** How tall the phone's sheet stands at each snap, pixels: peek its handle and its row of tabs, as icons; full stands 8 short of the map's top. */
export const SHEET_HEIGHTS: Record<Exclude<SheetSnap, 'full'>, number> = { peek: 84, half: 420 };

/** What the tabs' names add to the sheet's peek, pixels, where they show. */
export const TAB_LABELS_HEIGHT = 8;

/** Where a phone's screen is wide enough for its tabs' names under their icons: every name fits its tab. */
export const TAB_LABELS_QUERY = '(width >= 36rem)';

/** Room the phone's sheet leaves above it at full height: the header's, and a little more, pixels. */
export const SHEET_TOP_GAP = 60;

/** Below this width the explorer is the phone's: no rail, the panel a sheet over the map. */
export const PHONE_QUERY = '(width < 64rem)';
