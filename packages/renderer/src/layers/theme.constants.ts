import type { Theme } from '@railtime/network/facts.types';
import type { Credit } from '../transitMap.types';
import type { Palette } from './theme.types';

/** Each theme's palette. The basemap is recoloured in code so both themes match the overlay exactly. */
export const PALETTES: Record<Theme, Palette> = {
  dark: {
    background: '#0b0e13',
    water: '#151c27',
    green: '#10171a',
    landuse: '#0e1218',
    building: '#161b22',
    road: '#1d232c',
    majorRoad: '#262d38',
    rail: '#2a313c',
    boundary: '#2e343d',
    basemapText: '#7d8590',
    basemapHalo: '#0b0e13',
    label: '#f1f3f5',
    labelHalo: '#0b0e13',
    glowOpacity: 0.3,
    interchangeRing: '#11151b',
    viewport: '#ffffff',
  },
  light: {
    background: '#f3f2ee',
    water: '#cdd9e3',
    green: '#e2e9da',
    landuse: '#ebeae5',
    building: '#e3e1db',
    road: '#ffffff',
    majorRoad: '#ffffff',
    rail: '#d9d6cf',
    boundary: '#c9c6bf',
    basemapText: '#8b8f96',
    basemapHalo: '#f3f2ee',
    label: '#1b1e22',
    labelHalo: '#f3f2ee',
    glowOpacity: 0.18,
    interchangeRing: '#1b1e22',
    viewport: '#1b1e22',
  },
};

/** OpenFreeMap's Positron: free OSM vector tiles, no key. Recoloured per theme by `basemap.utils.ts`. */
export const DEFAULT_BASEMAP = 'https://tiles.openfreemap.org/styles/positron';

/** What the default basemap asks to be credited with. */
export const DEFAULT_BASEMAP_CREDITS: Credit[] = [
  { text: 'OpenFreeMap', url: 'https://openfreemap.org' },
  { text: '© OpenMapTiles', url: 'https://www.openmaptiles.org' },
];

/** Used when the basemap has no font of its own to offer. */
export const FALLBACK_FONT = ['Noto Sans Regular'];

/**
 * What a basemap filter compares in place of a value a feature lacks: a number past any bound, on
 * whichever side the comparison needs, so it fails as the missing value made it fail, without the
 * warning MapLibre prints for each such feature.
 */
export const MISSING_NUMBER = 1e9;
