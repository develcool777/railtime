/** Overlay sources and layers start with this; everything else on the map is basemap. */
export const OVERLAY_PREFIX = 'rt-';

/** The overlay's GeoJSON sources. */
export const SOURCES = {
  coverageHeat: 'rt-coverage-heat',
  coverageOutline: 'rt-coverage-outline',
  lines: 'rt-lines',
  ghosts: 'rt-ghosts',
  planned: 'rt-planned',
  transfers: 'rt-transfers',
  active: 'rt-active',
  growing: 'rt-growing',
  activeTransfers: 'rt-active-transfers',
  route: 'rt-route',
  routeStops: 'rt-route-stops',
  reachTrack: 'rt-reach-track',
  reachStops: 'rt-reach-stops',
  stations: 'rt-stations',
  pulses: 'rt-pulses',
  selection: 'rt-selection',
} as const;

/** The overlay's layers, bottom to top. */
export const LAYERS = {
  coverageHeat: 'rt-coverage-heat',
  coverageOutline: 'rt-coverage-outline',
  buildings: 'rt-buildings',
  ghosts: 'rt-ghosts',
  glow: 'rt-glow',
  lines: 'rt-lines',
  planned: 'rt-planned',
  transferCasing: 'rt-transfer-casing',
  transferCore: 'rt-transfer-core',
  activeGlow: 'rt-active-glow',
  activeLines: 'rt-active-lines',
  activePlanned: 'rt-active-planned',
  growingGlow: 'rt-growing-glow',
  growingLines: 'rt-growing-lines',
  growingPlanned: 'rt-growing-planned',
  headGlow: 'rt-head-glow',
  headCore: 'rt-head-core',
  activeTransferCasing: 'rt-active-transfer-casing',
  activeTransferCore: 'rt-active-transfer-core',
  motion: 'rt-motion',
  pulses: 'rt-pulses',
  selection: 'rt-selection',
  stations: 'rt-stations',
  labels: 'rt-labels',
  newLabels: 'rt-new-labels',
  routeCasing: 'rt-route-casing',
  routeLine: 'rt-route-line',
  routeWalk: 'rt-route-walk',
  routeStops: 'rt-route-stops',
  routePassLabels: 'rt-route-pass-labels',
  routeLabels: 'rt-route-labels',
  reachTrack: 'rt-reach-track',
  reachStops: 'rt-reach-stops',
  reachLabels: 'rt-reach-labels',
  reachOriginLabel: 'rt-reach-origin-label',
} as const;

/** How strongly lines out of focus still show (`focusedLines`): a fraction of their usual opacity. */
export const UNFOCUSED_OPACITY = 0.15;

/** How strongly the stations still show behind a route: a fraction of their usual opacity. Their names go. */
export const BACKDROP_STATION_OPACITY = 0.25;

/** Round ends and joins, so segments meet without seams. */
export const LINE_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' } as const;

/** A plan's track, not built: dash and gap, in line widths, on the map and while its step plays. */
export const PLANNED_DASHES = [1.2, 1];

/** A plan's track drawn bold (`boldPlans`): longer dashes, a shorter gap, on wider line. */
export const BOLD_PLANNED_DASHES = [2.4, 0.8];

/** Ordinary station labels show from this zoom; new stations are labelled at any zoom. */
export const LABEL_MIN_ZOOM = 12;

/**
 * The closest zoom the overlay's sources are cut into tiles at: closer, MapLibre stretches those
 * tiles, still within a metre. A source sent new data each frame (a line growing) is cut again for
 * every tile in view: at street level in 3D, a score of them at zoom 18, a few at 14.
 */
export const OVERLAY_SOURCE_MAX_ZOOM = 14;

/**
 * The closest zoom the growing piece of a line and its head are cut at: sent every frame, each send
 * re-cuts every tile of it in view, and a few metres moving need no finer than 0.6 m, under a pixel
 * at street level.
 */
export const GROWING_SOURCE_MAX_ZOOM = 13;

/** How long a station takes to pop in, ms. */
export const POP_IN_MS = 450;

/** How long a new station's pulse ring takes to expand and fade, ms. */
export const PULSE_MS = 1100;

/** How much bigger a pulse ring gets than the dot it starts from. */
export const PULSE_GROWTH = 1.8;
