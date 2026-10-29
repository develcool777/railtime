import type { Credit } from '../transitMap.types';

/** Device pixels per CSS pixel in a still: sharp on a high-density screen, whatever the one it is taken on. */
export const STILL_PIXEL_RATIO = 2;

/** How long a still waits for its tiles before it is taken as it is, ms. */
export const STILL_TIMEOUT_MS = 8000;

/** The image format of a still. */
export const STILL_FORMAT = 'image/webp';

/** A still's quality, 0..1. */
export const STILL_QUALITY = 0.85;

/** The basemap's data, credited on a page of stills as the map credits it. */
export const OPENSTREETMAP_CREDIT: Credit = { text: '© OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' };
