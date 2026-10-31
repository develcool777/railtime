/** The minimap's GeoJSON sources. */
export const MINIMAP_SOURCES = {
  lines: 'mm-lines',
  active: 'mm-active',
  viewport: 'mm-viewport',
} as const;

/** The minimap's layers, bottom to top. */
export const MINIMAP_LAYERS = {
  lines: 'mm-lines',
  activeGlow: 'mm-active-glow',
  active: 'mm-active',
  viewport: 'mm-viewport',
} as const;
