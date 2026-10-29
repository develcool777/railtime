import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { OVERLAY_PREFIX } from './layers.constants';
import { FALLBACK_FONT } from './theme.constants';
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

/**
 * Sets a paint property where the layer has it; not every layer has every property.
 *
 * @param map - The map.
 * @param layerId - The layer.
 * @param property - The paint property.
 * @param value - Its new value.
 */
const paintIfPresent = (map: MapLibreMap, layerId: string, property: string, value: unknown): void => {
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
  for (const layer of map.getStyle().layers) if (!layer.id.startsWith(OVERLAY_PREFIX)) recolorLayer(map, layer, palette, options.labels);
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
