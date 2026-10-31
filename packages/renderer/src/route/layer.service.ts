import type { ExpressionSpecification, FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection, PointFeature, RouteFeature, RouteStopProperties } from '../layers/features.types';
import { emptyCollection } from '../layers/features.utils';
import { byZoom } from '../layers/style.utils';
import { LAYERS, LINE_LAYOUT, SOURCES } from '../layers/ids.constants';
import { MapLayer } from '../layers/layer.service';
import type { Palette } from '../layers/theme.types';

/**
 * A route over the network, drawn above everything else: each ride wide, in its line's colour, on a
 * casing that lifts it off the map; each walk dashed; a dot at each stop it passes, a ring where a
 * ride begins or ends, a filled dot at its end. Its start, changes and end are always named; the
 * stops between, smaller, where there is room.
 */
export class RouteLayer extends MapLayer {
  /** The route's stretches: kept, so installing draws one shown before the basemap loaded. */
  private features: RouteFeature[] = [];
  /** Its stops, marked. */
  private stops: PointFeature<RouteStopProperties>[] = [];

  public constructor(map: MapLibreMap) {
    super(map);
  }

  /**
   * Whether a route is drawn.
   *
   * @returns True if one is.
   */
  public get shown(): boolean {
    return this.features.length > 0;
  }

  /**
   * Adds the route's casing, rides, walks, stops and names.
   *
   * @param font - A font stack the basemap's glyph server has.
   */
  public install(font: string[]): void {
    this.addSource(SOURCES.route);
    this.addSource(SOURCES.routeStops);
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
    const isEnd: ExpressionSpecification = ['==', ['get', 'kind'], 'end'];
    // A size by zoom must be the outermost expression, so each stop's kind is chosen inside it.
    const isPassed: ExpressionSpecification = ['==', ['get', 'kind'], 'pass'];
    this.map.addLayer({
      id: LAYERS.routeStops,
      type: 'circle',
      source: SOURCES.routeStops,
      paint: {
        'circle-radius': byZoom(['case', isPassed, 2.2, 4.5], ['case', isPassed, 4.5, 9]),
        'circle-color': ['case', isEnd, ['get', 'color'], '#ffffff'],
        'circle-stroke-color': ['case', isEnd, '#ffffff', ['get', 'color']],
        'circle-stroke-width': byZoom(['case', isPassed, 1.2, 2.5], ['case', isPassed, 2, 4]),
      },
    });
    this.map.addLayer({
      id: LAYERS.routePassLabels,
      type: 'symbol',
      source: SOURCES.routeStops,
      filter: isPassed,
      layout: { 'text-field': ['get', 'name'], 'text-font': font, 'text-size': byZoom(10.5, 13), 'text-anchor': 'left', 'text-offset': [0.8, 0] },
      paint: { 'text-halo-width': 1.5 },
    });
    this.map.addLayer({
      id: LAYERS.routeLabels,
      type: 'symbol',
      source: SOURCES.routeStops,
      filter: ['!', isPassed],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': font,
        'text-size': byZoom(12, 15),
        'text-anchor': 'left',
        'text-offset': [1, 0],
        'text-allow-overlap': true,
      },
      paint: { 'text-halo-width': 2 },
    });
    this.draw();
  }

  /**
   * Colours the casing and the walks for the theme.
   *
   * @param palette - The theme's colours.
   */
  public applyPalette(palette: Palette): void {
    this.map.setPaintProperty(LAYERS.routeCasing, 'line-color', palette.labelHalo);
    this.map.setPaintProperty(LAYERS.routeWalk, 'line-color', palette.label);
    for (const layer of [LAYERS.routePassLabels, LAYERS.routeLabels]) {
      this.map.setPaintProperty(layer, 'text-color', palette.label);
      this.map.setPaintProperty(layer, 'text-halo-color', palette.labelHalo);
    }
    this.map.setPaintProperty(LAYERS.routePassLabels, 'text-opacity', 0.8);
  }

  /**
   * Draws a route, or clears it.
   *
   * @param features - The route's stretches; none to clear it.
   * @param stops - Its stops, marked; none to clear them.
   */
  public update(features: RouteFeature[], stops: PointFeature<RouteStopProperties>[]): void {
    this.features = features;
    this.stops = stops;
    this.draw();
  }

  /** Puts the route kept in the sources; before they are installed, nothing. */
  private draw(): void {
    const collection: FeatureCollection<RouteFeature> = { ...emptyCollection<RouteFeature>(), features: this.features };
    this.setData(SOURCES.route, collection);
    this.setData(SOURCES.routeStops, { ...emptyCollection<PointFeature<RouteStopProperties>>(), features: this.stops });
  }
}
