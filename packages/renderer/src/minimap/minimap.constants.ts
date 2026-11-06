/** The minimap's GeoJSON sources. */
export const MINIMAP_SOURCES = {
  lines: 'mm-lines',
  planned: 'mm-planned',
  active: 'mm-active',
} as const;

/** The minimap's layers, bottom to top. */
export const MINIMAP_LAYERS = {
  lines: 'mm-lines',
  planned: 'mm-planned',
  active: 'mm-active',
  activePlanned: 'mm-active-planned',
} as const;

/** How wide the minimap draws every line, pixels: a line growing as wide as it stays, so it never swells and shrinks back. */
export const MINIMAP_LINE_WIDTH = 1.2;

/** Room around the city in the minimap, pixels. */
export const MINIMAP_PADDING = 8;

/**
 * The least time between two updates of the line growing, ms: thirty a second, smooth enough in a small
 * inset, each a whole map redrawn.
 */
export const MINIMAP_UPDATE_MS = 33;

/** The class of the box outlining the main camera's view: `transitMap.css` draws it. */
export const MINIMAP_VIEWPORT_CLASS = 'rt-minimap-viewport';

/** The custom property the box's colour is set in, the theme's. */
export const MINIMAP_VIEWPORT_COLOR = '--rt-minimap-viewport';

/** The smallest the box is drawn, pixels: a camera close in still shows where it is. */
export const MINIMAP_VIEWPORT_MIN_PX = 4;
