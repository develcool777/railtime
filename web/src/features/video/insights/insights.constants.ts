import type { InsightsPanel } from '~/features/video/insights/insights.types';

/** The most lines a video's panel lists: as many as fit its column. */
export const INSIGHTS_LINES = 10;

/** The place each panel comes in at: an edge's first, the other's, then their second. */
export const INSIGHTS_PLACES: Record<InsightsPanel, number> = { growth: 0, lines: 1, decades: 2, coverage: 3 };

/** How long into the scene the first panel starts in, ms: as the camera lies flat and draws back. */
export const INSIGHTS_START_MS = 900;

/** How long after a panel the next starts in, ms. */
export const INSIGHTS_STAGGER_MS = 450;

/** How long a panel takes to reveal its chart, ms. */
export const INSIGHTS_DRAW_MS = 2200;

/** How far a panel slides in from its edge, in `vmin`. */
export const PANEL_SLIDE_VMIN = 8;

/** How tall a chart is in each kind of panel, as a share of the frame's height. */
export const INSIGHTS_CHART_SHARES = { tall: 0.3, short: 0.15 };
