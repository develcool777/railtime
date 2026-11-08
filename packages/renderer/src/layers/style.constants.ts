/** The zoom with the whole city in view: the first stop of every width that changes with zoom (`byZoom`). */
export const CITY_ZOOM = 10;

/** The zoom of a neighbourhood: the last stop of every width that changes with zoom (`byZoom`). */
export const STREET_ZOOM = 14;

/** How far apart lines on shared track are drawn, pixels per side-by-side slot, at the city's zoom and the street's. */
export const SIDE_BY_SIDE_PX: readonly [number, number] = [2.4, 6];
