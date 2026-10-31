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
  heads: 'rt-heads',
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
  ghosts: 'rt-ghosts',
  glow: 'rt-glow',
  lines: 'rt-lines',
  planned: 'rt-planned',
  transferCasing: 'rt-transfer-casing',
  transferCore: 'rt-transfer-core',
  activeGlow: 'rt-active-glow',
  activeLines: 'rt-active-lines',
  headGlow: 'rt-head-glow',
  headCore: 'rt-head-core',
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

/** How strongly lines out of focus still show (`focusLines`): a fraction of their usual opacity. */
export const UNFOCUSED_OPACITY = 0.15;

/** How strongly the stations still show behind a route: a fraction of their usual opacity. Their names go. */
export const BACKDROP_STATION_OPACITY = 0.25;

/** Round ends and joins, so segments meet without seams. */
export const LINE_LAYOUT = { 'line-cap': 'round', 'line-join': 'round' } as const;

/** Ordinary station labels show from this zoom; new stations are labelled at any zoom. */
export const LABEL_MIN_ZOOM = 12;

/** How long a station takes to pop in, ms. */
export const POP_IN_MS = 450;

/** How long a new station's pulse ring takes to expand and fade, ms. */
export const PULSE_MS = 1100;

/** How much bigger a pulse ring gets than the dot it starts from. */
export const PULSE_GROWTH = 1.8;
