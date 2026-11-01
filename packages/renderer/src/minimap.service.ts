import { type GeoJSONSource, type LngLatBoundsLike, Map as MapLibreMap } from 'maplibre-gl';
import { recolorBasemap } from './layers/basemap.utils';
import type { FeatureCollection, LineFeature, NetworkSnapshot } from './layers/snapshot.types';
import { emptyCollection } from './layers/snapshot.utils';
import type { Palette } from './layers/theme.types';
import type { Bounds } from '@railtime/core/geometry.types';
import { MINIMAP_LAYERS, MINIMAP_PADDING, MINIMAP_SOURCES, MINIMAP_UPDATE_MS } from './minimap.constants';

/**
 * A small, fixed overview of the whole city: the network so far, the change happening now, and a
 * box showing where the main camera is looking. Updates sent before its style loads are kept and
 * applied once it has; the line growing and the box, which change every frame, at most ten times a
 * second.
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
  /** The latest data for each source, until the style has loaded or the next update is due. */
  private readonly pending = new Map<string, object>();
  /** The next update of what changes every frame, if one is due. */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** When what changes every frame was last sent, ms. */
  private flushedAt = -Infinity;

  public constructor(container: HTMLElement, style: string, bounds: Bounds, palette: Palette) {
    this.palette = palette;
    this.map = new MapLibreMap({
      container,
      style,
      bounds: bounds as LngLatBoundsLike,
      fitBoundsOptions: { padding: MINIMAP_PADDING },
      interactive: false,
      attributionControl: false,
    });
    this.map.on('style.load', () => this.install());
    // Created hidden, it first fitted the city into nothing: fit it again whenever it gets a size.
    this.resizeObserver = new ResizeObserver(() => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      this.map.resize();
      this.map.fitBounds(bounds as LngLatBoundsLike, { padding: MINIMAP_PADDING, animate: false });
    });
    this.resizeObserver.observe(container);
  }

  /**
   * Shows the network as it stands, as the main map does: its track built, and a plan's dashed.
   *
   * @param snapshot - The main map's network.
   */
  public setNetwork(snapshot: Pick<NetworkSnapshot, 'lines' | 'planned'>): void {
    this.setData(MINIMAP_SOURCES.lines, snapshot.lines);
    this.setData(MINIMAP_SOURCES.planned, snapshot.planned);
  }

  /**
   * Shows the change playing now, highlighted.
   *
   * @param lines - The playing step's line features.
   */
  public setActive(lines: FeatureCollection<LineFeature>): void {
    this.setSoon(MINIMAP_SOURCES.active, lines);
  }

  /**
   * Outlines where the main camera is looking.
   *
   * @param bounds - The main map's visible bounds.
   */
  public setViewport(bounds: Bounds): void {
    const [[west, south], [east, north]] = bounds;
    this.setSoon(MINIMAP_SOURCES.viewport, {
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
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.resizeObserver.disconnect();
    this.map.remove();
  }

  /** Adds sources and layers once the style has loaded, then applies what arrived before. */
  private install(): void {
    recolorBasemap(this.map, this.palette, { labels: false });
    for (const source of Object.values(MINIMAP_SOURCES)) this.map.addSource(source, { type: 'geojson', data: emptyCollection() });
    this.map.addLayer({ id: MINIMAP_LAYERS.lines, type: 'line', source: MINIMAP_SOURCES.lines, paint: { 'line-color': ['get', 'color'], 'line-width': 1.2 } });
    this.map.addLayer({
      id: MINIMAP_LAYERS.planned,
      type: 'line',
      source: MINIMAP_SOURCES.planned,
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.2, 'line-dasharray': [2, 1.5] },
    });
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
   * Replaces a source's data that changes every frame: at once if the last update was long enough
   * ago, else, its latest, when the next is due.
   *
   * @param source - The source id.
   * @param data - GeoJSON.
   */
  private setSoon(source: string, data: object): void {
    if (!this.ready) {
      this.pending.set(source, data);
      return;
    }
    this.pending.set(source, data);
    if (this.flushTimer !== null) return;
    const wait = this.flushedAt + MINIMAP_UPDATE_MS - performance.now();
    if (wait <= 0) this.flush();
    else this.flushTimer = setTimeout(() => this.flush(), wait);
  }

  /** Sends what is waiting. */
  private flush(): void {
    this.flushTimer = null;
    this.flushedAt = performance.now();
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
