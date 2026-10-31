import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { LAYERS } from '../layers/ids.constants';
import { MapLayer } from '../layers/layer.service';
import type { Palette } from '../layers/theme.types';
import { BASEMAP_BUILDINGS, BUILDINGS_FULL_ZOOM, BUILDINGS_OPACITY, BUILDINGS_RISE_ZOOM } from './layer.constants';

/**
 * The basemap's own buildings standing in 3D, under the network: flat from afar, rising to their
 * heights as the camera comes down. Hidden until the map is seen in 3D; a basemap without buildings
 * has none.
 */
export class BuildingsLayer extends MapLayer {
  /** Whether they stand. */
  private shown = false;

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /**
   * Adds the buildings, standing if the map is already seen in 3D.
   *
   * @param _font - Unused: nothing here is labelled.
   */
  public install(_font: string[]): void {
    if (!this.map.getSource(BASEMAP_BUILDINGS.source)) return;
    /**
     * A building's height in metres, rising with the zoom.
     *
     * @param property - Its top's or its bottom's.
     * @returns The expression.
     */
    const rising = (property: string): ExpressionSpecification => [
      'interpolate',
      ['linear'],
      ['zoom'],
      BUILDINGS_RISE_ZOOM,
      0,
      BUILDINGS_FULL_ZOOM,
      ['get', property],
    ];
    this.map.addLayer({
      id: LAYERS.buildings,
      type: 'fill-extrusion',
      source: BASEMAP_BUILDINGS.source,
      'source-layer': BASEMAP_BUILDINGS.sourceLayer,
      minzoom: BUILDINGS_RISE_ZOOM,
      layout: { visibility: this.shown ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-height': rising('render_height'),
        'fill-extrusion-base': rising('render_min_height'),
        'fill-extrusion-opacity': BUILDINGS_OPACITY,
      },
    });
  }

  /**
   * Colours the buildings as the basemap's built-up ground.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    if (this.map.getLayer(LAYERS.buildings)) this.map.setPaintProperty(LAYERS.buildings, 'fill-extrusion-color', palette.landuse);
  }

  /**
   * Stands the buildings up, or lays them down.
   *
   * @param shown - Whether they stand.
   */
  public show(shown: boolean): void {
    this.shown = shown;
    if (this.map.getLayer(LAYERS.buildings)) this.map.setLayoutProperty(LAYERS.buildings, 'visibility', shown ? 'visible' : 'none');
  }
}
