import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, RouteFeature } from './features.types';
import { emptyCollection } from './features.utils';
import { byZoom } from './layerStyle.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from './layers.constants';
import { MapLayer } from './mapLayer.service';
import type { Palette } from './theme.types';

/** A route over the network: each ride wide, in its line's colour, on a casing that lifts it off the map; each walk dashed. */
export class RouteLayer extends MapLayer {
  public constructor(map: MapLibreMap) {
    super(map);
  }

  /** Adds the route's casing, rides and walks. */
  public install(): void {
    this.addSource(SOURCES.route);
    const ridden: FilterSpecification = ['!', ['get', 'walk']];
    this.map.addLayer({
      id: LAYERS.routeCasing,
      type: 'line',
      source: SOURCES.route,
      filter: ridden,
      layout: LINE_LAYOUT,
      paint: { 'line-width': byZoom(9, 18) },
    });
    this.map.addLayer({
      id: LAYERS.routeLine,
      type: 'line',
      source: SOURCES.route,
      filter: ridden,
      layout: LINE_LAYOUT,
      paint: { 'line-color': ['get', 'color'], 'line-width': byZoom(5, 11) },
    });
    this.map.addLayer({
      id: LAYERS.routeWalk,
      type: 'line',
      source: SOURCES.route,
      filter: ['get', 'walk'],
      layout: { 'line-cap': 'round' },
      paint: { 'line-width': byZoom(3, 5), 'line-dasharray': [0.5, 2] },
    });
  }

  /**
   * Colours the casing and the walks for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.routeCasing, 'line-color', palette.labelHalo);
    this.map.setPaintProperty(LAYERS.routeWalk, 'line-color', palette.label);
  }

  /**
   * Draws a route, or clears it.
   *
   * @param features - The route's stretches; none to clear it.
   */
  public update(features: RouteFeature[]): void {
    const collection: FeatureCollection<RouteFeature> = { ...emptyCollection<RouteFeature>(), features };
    this.setData(SOURCES.route, collection);
  }
}
