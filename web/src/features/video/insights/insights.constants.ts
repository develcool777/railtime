import type { InsightsPanel } from '~/features/video/insights/insights.types';

/** The most lines a video's panel lists: as many as leave the coverage chart room in their column. */
export const INSIGHTS_LINES = 6;

/** How wide each column of panels is, in `vw`: as it is laid out, and what the map keeps clear of. */
export const INSIGHTS_COLUMN_VW = 27;

/** How far the network keeps from each edge beside the panels, in `vw`: a column, the margin it stands at and some room. The end card over them lies in what this leaves. */
export const INSIGHTS_CLEAR_VW = INSIGHTS_COLUMN_VW + 3;

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
