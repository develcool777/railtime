import type { PreviewSize, PreviewTheme } from './preview.types.ts';

/** A preview's size in CSS pixels: a city card's picture, a little wider than most cards, which crop it. */
export const PREVIEW_SIZE: PreviewSize = { width: 400, height: 170 };

/** A social card's size in CSS pixels: drawn at twice that, 1200 × 630, as link previews want. */
export const SOCIAL_SIZE: PreviewSize = { width: 600, height: 315 };

/** The theme a social card is drawn in. */
export const SOCIAL_THEME: PreviewTheme = 'dark';

/** The themes a preview is drawn in, one picture each. */
export const PREVIEW_THEMES: PreviewTheme[] = ['dark', 'light'];

/** Room kept around the track in a preview, CSS pixels. */
export const PREVIEW_PADDING = 18;

/** The basemap's tile size: a world `TILE_SIZE · 2^zoom` pixels wide, as MapLibre lays it out. */
export const TILE_SIZE = 512;

/** The deepest a preview zooms, for a network of one short line. */
export const MAX_PREVIEW_ZOOM = 15;

/** How long Chrome may take to draw one preview, ms: tiles come over the network. */
export const PREVIEW_TIMEOUT_MS = 60_000;
