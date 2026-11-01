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
  viewport: 'mm-viewport',
} as const;

/** Room around the city in the minimap, pixels. */
export const MINIMAP_PADDING = 8;
