/** The minimap's GeoJSON sources. */
export const MINIMAP_SOURCES = {
  lines: 'mm-lines',
  planned: 'mm-planned',
  active: 'mm-active',
  viewport: 'mm-viewport',
} as const;

/** The minimap's layers, bottom to top. */
export const MINIMAP_LAYERS = {
  lines: 'mm-lines',
  planned: 'mm-planned',
  activeGlow: 'mm-active-glow',
  active: 'mm-active',
  activePlanned: 'mm-active-planned',
  viewport: 'mm-viewport',
} as const;

/** Room around the city in the minimap, pixels. */
export const MINIMAP_PADDING = 8;

/**
 * The least time between two updates of what changes every frame (the line growing, the view's box),
 * ms: a small inset needs no more than ten a second, and each is a whole map redrawn.
 */
export const MINIMAP_UPDATE_MS = 100;
