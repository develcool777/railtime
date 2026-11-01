/** Where the default basemap keeps its buildings, with their heights (`render_height`, `render_min_height`). */
export const BASEMAP_BUILDINGS = { source: 'openmaptiles', sourceLayer: 'building' } as const;

/** The zoom the buildings start to rise from, flat below it. */
export const BUILDINGS_RISE_ZOOM = 13;

/** The zoom they stand at full height from. */
export const BUILDINGS_FULL_ZOOM = 15;

/** How solid they stand: a little see-through, so the streets behind show. */
export const BUILDINGS_OPACITY = 0.85;
