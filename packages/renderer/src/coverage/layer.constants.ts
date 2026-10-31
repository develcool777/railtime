import type { CoverageBand } from '../transitMap.types';

/**
 * The bands coverage is shaded in, nearest first: a 5-, 10- and 15-minute walk, about, as the crow
 * flies. One hue, deepest nearest, clear on either theme.
 */
export const COVERAGE_BANDS: CoverageBand[] = [
  { upTo: 400, label: 'Under 400 m', color: '#0b7a75' },
  { upTo: 800, label: '400–800 m', color: '#1fa89f' },
  { upTo: 1200, label: '800 m – 1.2 km', color: '#7fd6cd' },
];

/** The headline distance, metres: about a 10-minute walk, the common planning rule. */
export const COVERAGE_HEADLINE_METRES = 800;

/** How strongly a band is shaded over the basemap, 0..255. */
export const COVERAGE_ALPHA = 150;

/** How strongly the rest of the city is tinted, so the uncovered part reads as city, 0..255. */
export const UNCOVERED_ALPHA = 28;

/** The grey the rest of the city is tinted. */
export const UNCOVERED_COLOR = '#808080';

/** The smallest cell the grid is cut into, km: finer than a walk's precision buys nothing. */
export const MIN_CELL_KM = 0.1;

/** The most cells a city's grid has: a big city gets coarser cells, so a step stays quick to redraw. */
export const MAX_CELLS = 120_000;
