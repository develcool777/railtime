import maplibregl, { type GeoJSONSource, type LngLatBoundsLike, type Map as MapLibreMap } from 'maplibre-gl';
import { recolorBasemap } from '../layers/basemap.utils';
import type { FeatureCollection, LineFeature } from '../layers/features.types';
import { emptyCollection } from '../layers/features.utils';
import type { Palette } from '../layers/theme.types';
import type { Bounds } from '../model/geometry.types';
import { MINIMAP_LAYERS, MINIMAP_SOURCES } from './minimap.constants';

/**
 * A small, fixed overview of the whole city: the network so far, the change happening now, and a
 * box showing where the main camera is looking. Updates sent before its style loads are kept and
 * applied once it has.
 */
export class Minimap {
  /** The minimap's own non-interactive map. */
  private readonly map: MapLibreMap;
  /** Watches the container, which may be shown or resized after the map is created. */
  private readonly resizeObserver: ResizeObserver;
  /** Its style has loaded and its sources exist. */
  private ready = false;
  /** The theme's colours. */
  private palette: Palette;
  /** The latest data for each source, until the style has loaded. */
  private readonly pending = new Map<string, object>();

  public constructor(container: HTMLElement, style: string, bounds: Bounds, palette: Palette) {
    this.palette = palette;
    this.map = new maplibregl.Map({
      container,
      style,
      bounds: bounds as LngLatBoundsLike,
      fitBoundsOptions: { padding: 8 },
      interactive: false,
      attributionControl: false,
    });
    this.map.on('style.load', () => this.install());
    this.resizeObserver = new ResizeObserver(() => this.map.resize());
    this.resizeObserver.observe(container);
  }

  /**
   * Shows the network as it stands.
   *
   * @param lines - The main map's line features.
   */
  public setLines(lines: FeatureCollection<LineFeature>): void {
    this.setData(MINIMAP_SOURCES.lines, lines);
  }

  /**
   * Shows the change playing now, highlighted.
   *
   * @param lines - The playing step's line features.
   */
  public setActive(lines: FeatureCollection<LineFeature>): void {
    this.setData(MINIMAP_SOURCES.active, lines);
  }

  /**
   * Outlines where the main camera is looking.
   *
   * @param bounds - The main map's visible bounds.
   */
  public setViewport(bounds: Bounds): void {
    const [[west, south], [east, north]] = bounds;
    this.setData(MINIMAP_SOURCES.viewport, {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      },
    });
  }

  /**
   * Recolours the minimap for a theme.
   *
   * @param palette - The theme's colours.
   */
  public setPalette(palette: Palette): void {
    this.palette = palette;
    if (!this.ready) return;
    recolorBasemap(this.map, palette, { labels: false });
    this.map.setPaintProperty(MINIMAP_LAYERS.viewport, 'line-color', palette.viewport);
  }

  /** Removes the minimap and stops watching its container. */
  public destroy(): void {
    this.resizeObserver.disconnect();
    this.map.remove();
  }

  /** Adds sources and layers once the style has loaded, then applies what arrived before. */
  private install(): void {
    recolorBasemap(this.map, this.palette, { labels: false });
    for (const source of Object.values(MINIMAP_SOURCES)) this.map.addSource(source, { type: 'geojson', data: emptyCollection() });
    this.map.addLayer({ id: MINIMAP_LAYERS.lines, type: 'line', source: MINIMAP_SOURCES.lines, paint: { 'line-color': ['get', 'color'], 'line-width': 1.2 } });
    this.map.addLayer({
      id: MINIMAP_LAYERS.activeGlow,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      paint: { 'line-color': ['get', 'color'], 'line-width': 7, 'line-blur': 4, 'line-opacity': 0.8 },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.active,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.viewport,
      type: 'line',
      source: MINIMAP_SOURCES.viewport,
      paint: { 'line-color': this.palette.viewport, 'line-width': 1.5 },
    });
    this.ready = true;
    for (const [source, data] of this.pending) this.setData(source, data);
    this.pending.clear();
  }

  /**
   * Replaces a source's data, or keeps it until the style has loaded.
   *
   * @param source - The source id.
   * @param data - GeoJSON.
   */
  private setData(source: string, data: object): void {
    if (!this.ready) {
      this.pending.set(source, data);
      return;
    }
    (this.map.getSource(source) as GeoJSONSource).setData(data as Parameters<GeoJSONSource['setData']>[0]);
  }
}
