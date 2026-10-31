import type { FilterSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { OVERLAY_PREFIX } from './layers.constants';
import { FALLBACK_FONT, MISSING_NUMBER } from './theme.constants';
import type { Palette } from './theme.types';

/**
 * The colour for a basemap fill.
 *
 * @param sourceLayer - The OpenMapTiles source layer.
 * @param palette - The theme's colours.
 * @returns The fill colour.
 */
const fillColor = (sourceLayer: string, palette: Palette): string => {
  if (sourceLayer === 'water') return palette.water;
  if (sourceLayer === 'building') return palette.building;
  if (sourceLayer === 'park' || sourceLayer === 'landcover') return palette.green;
  return palette.landuse;
};

/**
 * The colour for a basemap line.
 *
 * @param sourceLayer - The OpenMapTiles source layer.
 * @param layerId - The style layer's id, which names the road class.
 * @param palette - The theme's colours.
 * @returns The line colour.
 */
const lineColor = (sourceLayer: string, layerId: string, palette: Palette): string => {
  if (sourceLayer === 'waterway') return palette.water;
  if (sourceLayer === 'boundary') return palette.boundary;
  if (layerId.includes('rail')) return palette.rail;
  return /motorway|trunk|primary|major/.test(layerId) ? palette.majorRoad : palette.road;
};

/** A paint property's name, as MapLibre types it. */
type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];

/** A paint property's value, as MapLibre types it. */
type PaintValue = Parameters<MapLibreMap['setPaintProperty']>[2];

/**
 * Sets a paint property where the layer has it; not every layer has every property.
 *
 * @param map - The map.
 * @param layerId - The layer.
 * @param property - The paint property.
 * @param value - Its new value.
 */
const paintIfPresent = (map: MapLibreMap, layerId: string, property: PaintProperty, value: PaintValue): void => {
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // The layer has no such property: nothing to recolour.
  }
};

/**
 * Recolours one basemap layer.
 *
 * @param map - The map.
 * @param layer - The style layer.
 * @param palette - The theme's colours.
 * @param labels - Whether to keep its labels.
 */
const recolorLayer = (map: MapLibreMap, layer: LayerSpecification, palette: Palette, labels: boolean): void => {
  const sourceLayer = 'source-layer' in layer ? (layer['source-layer'] ?? '') : '';
  switch (layer.type) {
    case 'background':
      paintIfPresent(map, layer.id, 'background-color', palette.background);
      break;
    case 'fill':
      paintIfPresent(map, layer.id, 'fill-color', fillColor(sourceLayer, palette));
      paintIfPresent(map, layer.id, 'fill-outline-color', fillColor(sourceLayer, palette));
      break;
    case 'fill-extrusion':
      paintIfPresent(map, layer.id, 'fill-extrusion-color', palette.building);
      break;
    case 'line':
      paintIfPresent(map, layer.id, 'line-color', lineColor(sourceLayer, layer.id, palette));
      break;
    case 'symbol':
      if (!labels || sourceLayer === 'poi' || sourceLayer === 'housenumber') {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
        break;
      }
      paintIfPresent(map, layer.id, 'text-color', palette.basemapText);
      paintIfPresent(map, layer.id, 'text-halo-color', palette.basemapHalo);
      paintIfPresent(map, layer.id, 'icon-opacity', 0);
      break;
  }
};

/**
 * Recolours an OpenMapTiles-schema basemap (OpenFreeMap, MapTiler…) to a palette, so the network is
 * the only colour on the map. Points of interest and house numbers are hidden; with `labels: false`
 * (the minimap) every label is.
 *
 * @param map - The map.
 * @param palette - The theme's colours.
 * @param options - `labels`: keep place and street labels.
 * @param options.labels - Keep place and street labels.
 */
export const recolorBasemap = (map: MapLibreMap, palette: Palette, options: { labels: boolean }): void => {
  for (const layer of map.getStyle().layers) {
    if (layer.id.startsWith(OVERLAY_PREFIX)) continue;
    recolorLayer(map, layer, palette, options.labels);
    // A filter comparing a value some features lack (a road number's length) gets a stand-in for it.
    const filter = 'filter' in layer ? layer.filter : undefined;
    const guarded = filter === undefined ? undefined : guardMissingNumbers(filter);
    if (guarded !== filter) map.setFilter(layer.id, guarded as FilterSpecification);
  }
};

/** The comparisons a missing value fails: `<` and `<=` fail with a stand-in above any bound, `>` and `>=` with one below. */
const COMPARISONS: Record<string, 1 | -1> = { '<': 1, '<=': 1, '>': -1, '>=': -1 };

/**
 * A filter whose comparisons of a feature's value with a number hold up when the feature lacks the
 * value: `["<=", ["get", "ref_length"], 6]` becomes `["<=", ["coalesce", ["get", "ref_length"], 1e9], 6]`.
 * Either way it fails for such a feature; MapLibre only warns of the first. The same filter comes
 * back where nothing needs it, so it can be told apart.
 *
 * @param filter - A style layer's filter.
 * @returns The filter, guarded where it needs to be.
 */
export const guardMissingNumbers = (filter: unknown): unknown => {
  if (!Array.isArray(filter)) return filter;
  const [operator, ...operands] = filter as unknown[];
  const isGet = (operand: unknown) => Array.isArray(operand) && operand[0] === 'get';
  const direction = typeof operator === 'string' ? COMPARISONS[operator] : undefined;
  if (direction !== undefined && operands.length === 2) {
    const [left, right] = operands;
    if (isGet(left) && typeof right === 'number') return [operator, ['coalesce', left, direction * MISSING_NUMBER], right];
    if (isGet(right) && typeof left === 'number') return [operator, left, ['coalesce', right, -direction * MISSING_NUMBER]];
  }
  const inner = operands.map(guardMissingNumbers);
  return inner.every((operand, position) => operand === operands[position]) ? filter : [operator, ...inner];
};

/**
 * The basemap's own font, which its glyph server is sure to have.
 *
 * @param map - The map, with its style loaded.
 * @returns A font stack.
 */
export const basemapFont = (map: MapLibreMap): string[] => {
  for (const layer of map.getStyle().layers) {
    const font = layer.type === 'symbol' ? layer.layout?.['text-font'] : undefined;
    if (Array.isArray(font) && font.every(name => typeof name === 'string')) return font as string[];
  }
  return FALLBACK_FONT;
};
