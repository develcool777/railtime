import type { Bounds } from '@railtime/core/geometry.types';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { MINIMAP_LAYERS, MINIMAP_PADDING, MINIMAP_SOURCES, MINIMAP_UPDATE_MS, MINIMAP_VIEWPORT_CLASS, MINIMAP_VIEWPORT_COLOR } from './minimap.constants';
import type { MinimapOptions } from './minimap.types';
import { viewportBox } from './minimap.utils';
import { recolorBasemap } from '../layers/basemap.utils';
import type { FeatureCollection, LineFeature, NetworkSnapshot } from '../layers/snapshot.types';
import { emptyCollection } from '../layers/snapshot.utils';
import type { Palette } from '../layers/theme.types';

/**
 * A small, fixed overview of the whole city: the network so far, the change happening now, and a
 * box showing where the main map's camera is looking, following it. Updates sent before its style loads are kept and
 * applied once it has; the line growing, which changes every frame, at most thirty times a second.
 * The box is an element over the map, styled by `transitMap.css`, not its data: following the camera
 * every frame, it costs no redraw.
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
  /** What it frames: the network's bounds. */
  private bounds: Bounds;
  /** The next update of what changes every frame, if one is due. */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  /** When what changes every frame was last sent, ms. */
  private flushedAt = -Infinity;
  /** The box outlining the main camera's view. */
  private readonly box: HTMLDivElement;
  /** The map whose view the box outlines. */
  private readonly main: MapLibreMap;

  public constructor(options: MinimapOptions) {
    const { container, main, createMap, style, bounds, palette } = options;
    this.palette = palette;
    this.bounds = bounds;
    this.main = main;
    this.map = createMap({
      container,
      style,
      bounds,
      fitBoundsOptions: { padding: MINIMAP_PADDING },
      interactive: false,
      attributionControl: false,
    });
    this.map.on('style.load', () => this.install());
    this.box = document.createElement('div');
    this.box.className = MINIMAP_VIEWPORT_CLASS;
    this.box.style.setProperty(MINIMAP_VIEWPORT_COLOR, palette.viewport);
    container.append(this.box);
    // The box follows the main camera; the minimap's own moves only to frame the city again, and the box goes with it.
    main.on('move', () => this.placeViewport());
    this.map.on('move', () => this.placeViewport());
    // Created hidden, it first fitted the city into nothing: fit it again whenever it gets a size.
    this.resizeObserver = new ResizeObserver(() => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      this.map.resize();
      this.map.fitBounds(this.bounds, { padding: MINIMAP_PADDING, animate: false });
    });
    this.resizeObserver.observe(container);
    this.placeViewport();
  }

  /**
   * Frames another network: the same city with a plan, or without.
   *
   * @param bounds - Its bounds.
   */
  public frame(bounds: Bounds): void {
    this.bounds = bounds;
    this.map.fitBounds(bounds, { padding: MINIMAP_PADDING, animate: false });
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
   * Recolours the minimap for a theme.
   *
   * @param palette - The theme's colours.
   */
  public setPalette(palette: Palette): void {
    this.palette = palette;
    this.box.style.setProperty(MINIMAP_VIEWPORT_COLOR, palette.viewport);
    if (!this.ready) return;
    recolorBasemap(this.map, palette, { labels: false });
  }

  /** Removes the minimap and stops watching its container. */
  public destroy(): void {
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.resizeObserver.disconnect();
    this.box.remove();
    this.map.remove();
  }

  /** Puts the box over the main camera's view, as the minimap projects it. */
  private placeViewport(): void {
    const view = this.main.getBounds();
    const { left, top, width, height } = viewportBox(this.map.project([view.getWest(), view.getNorth()]), this.map.project([view.getEast(), view.getSouth()]));
    Object.assign(this.box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    this.box.dataset.shown = '';
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
    // The playing step's track: built track glowing, a plan's broken, as on the map.
    this.map.addLayer({
      id: MINIMAP_LAYERS.activeGlow,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      filter: ['!', ['get', 'planned']],
      paint: { 'line-color': ['get', 'color'], 'line-width': 7, 'line-blur': 4, 'line-opacity': 0.8 },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.active,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      filter: ['!', ['get', 'planned']],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5 },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.activePlanned,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      filter: ['get', 'planned'],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
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
    void this.map.getSource<GeoJSONSource>(source)?.setData(data as Parameters<GeoJSONSource['setData']>[0]);
  }
}
