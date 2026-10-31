/** Nominatim's lookup of OpenStreetMap objects by id, which returns a relation's outline. */
export const NOMINATIM_LOOKUP = 'https://nominatim.openstreetmap.org/lookup';

/**
 * How far, in degrees, Nominatim may move an outline's edge as it simplifies it: about 50 m, finer than
 * the coverage's cells, and a few hundred points to a city.
 */
export const SIMPLIFY_DEGREES = 0.0005;

/** Decimals an outline's coordinates are kept to: about a metre. */
export const BOUNDARY_DECIMALS = 5;

/** Who is asking, as Nominatim's usage policy wants every client to say. */
export const USER_AGENT = 'railtime-data (https://github.com/develcool777/railtime)';

/** Nominatim's usage policy allows a request a second: the wait between cities, ms. */
export const NOMINATIM_PAUSE_MS = 1100;

/**
 * The least share of a city's stations its outline must hold. A network or a plan can run out past
 * its city's limits (London's Metropolitan to Amersham, Bristol's mass transit to its airport), but
 * not mostly: another city's outline would hold none.
 */
export const MIN_STATIONS_HELD = 0.5;
