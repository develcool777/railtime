import type { Bounds } from '@railtime/core/geometry.types';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import {
  MINIMAP_LAYERS,
  MINIMAP_LINE_WIDTH,
  MINIMAP_PADDING,
  MINIMAP_SOURCES,
  MINIMAP_UPDATE_MS,
  MINIMAP_VIEWPORT_CLASS,
  MINIMAP_VIEWPORT_COLOR,
} from './minimap.constants';
import type { MinimapOptions } from './minimap.types';
import { viewportBox } from './minimap.utils';
import { recolorBasemap } from '../layers/basemap.utils';
import type { FeatureCollection, LineFeature, NetworkSnapshot } from '../layers/snapshot.types';
import { emptyCollection } from '../layers/snapshot.utils';
import type { Palette } from '../layers/theme.types';

/**
 * A small, fixed overview of the whole city: the network so far, the change happening now, and a
 * box showing where the main map's camera is looking, following it. What it is given is sent as the
 * main map's frames say (`flush`), on their clock, at most thirty times a second, however often it
 * changes: each is a whole map redrawn. Kept until its style has loaded, and sent then. It outlives
 * the networks it shows, so it knows whether a change is on it. The box is an element over the map, styled by `transitMap.css`, not its data: following the camera
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
  /** The latest data for each source, until the style has loaded and the next update is due. */
  private readonly pending = new Map<string, object>();
  /** What it frames: the network's bounds. */
  private bounds: Bounds;
  /** The frame that last sent what was waiting, ms. */
  private flushedAt = -Infinity;
  /** A change is on it, or on its way: an empty drawing then clears it. */
  private showsActive = false;
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

  /** Whether the inset is drawn: its style, what was last sent to it and its tiles loaded. */
  public get drawn(): boolean {
    return this.map.isStyleLoaded() === true && this.map.areTilesLoaded();
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
    this.pending.set(MINIMAP_SOURCES.lines, snapshot.lines);
    this.pending.set(MINIMAP_SOURCES.planned, snapshot.planned);
  }

  /**
   * Shows the change playing now, highlighted; or clears it, once, whichever network it was of.
   *
   * @param lines - The playing step's line features; none for no change.
   */
  public setActive(lines: FeatureCollection<LineFeature>): void {
    const shows = lines.features.length > 0;
    if (!shows && !this.showsActive) return;
    this.showsActive = shows;
    this.pending.set(MINIMAP_SOURCES.active, lines);
  }

  /**
   * Sends what is waiting, if the last send was long enough ago: called every frame, so it runs on
   * the frames' clock and nothing else.
   *
   * @param now - The frame time.
   */
  public flush(now: number): void {
    if (!this.ready || this.pending.size === 0 || now - this.flushedAt < MINIMAP_UPDATE_MS) return;
    this.flushedAt = now;
    this.sendPending();
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
    this.map.addLayer({
      id: MINIMAP_LAYERS.lines,
      type: 'line',
      source: MINIMAP_SOURCES.lines,
      paint: { 'line-color': ['get', 'color'], 'line-width': MINIMAP_LINE_WIDTH },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.planned,
      type: 'line',
      source: MINIMAP_SOURCES.planned,
      paint: { 'line-color': ['get', 'color'], 'line-width': MINIMAP_LINE_WIDTH, 'line-dasharray': [2, 1.5] },
    });
    // The playing step's track, drawn as the rest: built track whole, a plan's broken.
    this.map.addLayer({
      id: MINIMAP_LAYERS.active,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      filter: ['!', ['get', 'planned']],
      paint: { 'line-color': ['get', 'color'], 'line-width': MINIMAP_LINE_WIDTH },
    });
    this.map.addLayer({
      id: MINIMAP_LAYERS.activePlanned,
      type: 'line',
      source: MINIMAP_SOURCES.active,
      filter: ['get', 'planned'],
      paint: { 'line-color': ['get', 'color'], 'line-width': MINIMAP_LINE_WIDTH, 'line-dasharray': [2, 1.5] },
    });
    this.ready = true;
    this.sendPending();
  }

  /** Sends each source its latest data. */
  private sendPending(): void {
    for (const [source, data] of this.pending) void this.map.getSource<GeoJSONSource>(source)?.setData(data as Parameters<GeoJSONSource['setData']>[0]);
    this.pending.clear();
  }
}
