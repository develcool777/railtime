import type { CoverageBand, CoverageDistance } from '../facts/facts.types';
/** The smallest cell the grid is cut into, km: finer than a walk's precision buys nothing. */
export const MIN_CELL_KM = 0.1;

/** The most cells a city's grid has: a big city gets coarser cells, so a step stays quick to redraw. */
export const MAX_CELLS = 120_000;

/**
 * The bands coverage is shaded in, nearest first: a 5-, 10-, 15-, 20- and 25-minute walk, about, as
 * the crow flies. One hue, deepest nearest, clear on either theme.
 */
export const COVERAGE_BANDS: CoverageBand[] = [
  { upTo: 400, label: 'Under 400 m', color: '#08635f' },
  { upTo: 800, label: '400–800 m', color: '#0b8a83' },
  { upTo: 1200, label: '800 m – 1.2 km', color: '#1fa89f' },
  { upTo: 1600, label: '1.2–1.6 km', color: '#62c9bf' },
  { upTo: 2000, label: '1.6–2 km', color: '#a8e6df' },
];

/** The distances coverage may be measured within, nearest first: each band's far edge. */
export const COVERAGE_DISTANCES: CoverageDistance[] = [400, 800, 1200, 1600, 2000];

/** The distance coverage is measured within unless asked otherwise, metres: about a 10-minute walk, the common planning rule. */
export const COVERAGE_DEFAULT_METRES: CoverageDistance = 800;
