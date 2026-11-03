/** How long the camera takes to pull back to the whole network when playback ends, ms. */
export const END_OVERVIEW_MS = 2000;

/**
 * Longest a step waits, as its camera move ends, for the map's tiles where it arrives, real seconds:
 * the line starts growing where the streets are drawn, and a slow network never stalls playback.
 */
export const MAX_TILE_WAIT_SECONDS = 1.5;
