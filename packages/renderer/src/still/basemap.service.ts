import { boundsOf } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import { type GeoJSONSource, type LineLayerSpecification, Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import { STILL_FORMAT, STILL_LINE_WIDTH, STILL_PIXEL_RATIO, STILL_QUALITY, STILL_TIMEOUT_MS, STILL_TRACK } from './basemap.constants';
import type { BasemapStillOptions, StillRequest, StillTrack } from './basemap.types';
import { recolorBasemap } from '../layers/basemap.utils';
import { LINE_LAYOUT } from '../layers/ids.constants';
import { DEFAULT_BASEMAP, PALETTES } from '../layers/theme.constants';

/**
 * Still pictures of the basemap, for previews: one hidden map, moved to each view in turn and
 * photographed once its tiles are in, so a page of previews costs one WebGL context, not one each.
 * The basemap is the map's own, in the same theme colours, with any track asked for drawn over it.
 * Browser only.
 */
export class BasemapStill {
  /** The hidden map. */
  private readonly map: MapLibreMap;
  /** Its container, off screen. */
  private readonly container: HTMLDivElement;
  /** The style has loaded and been recoloured. */
  private readonly loaded: Promise<void>;
  /** The last still asked for, settled: each waits for the one before. */
  private queue: Promise<void> = Promise.resolve();

  public constructor(options: BasemapStillOptions = {}) {
    if (options.workerUrl) setWorkerUrl(options.workerUrl);
    const theme = options.theme ?? 'dark';
    this.container = document.createElement('div');
    // Laid out, so MapLibre draws, but off screen and out of the way.
    Object.assign(this.container.style, { position: 'fixed', left: '-10000px', top: '0', width: '320px', height: '180px', pointerEvents: 'none' });
    document.body.append(this.container);
    const createMap = options.createMap ?? (mapOptions => new MapLibreMap(mapOptions));
    this.map = createMap({
      container: this.container,
      style: DEFAULT_BASEMAP,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: STILL_PIXEL_RATIO,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    this.loaded = new Promise(resolve =>
      this.map.once('style.load', () => {
        recolorBasemap(this.map, PALETTES[theme], { labels: true });
        this.installTrack();
        resolve();
      }),
    );
  }

  /**
   * Takes a still of the basemap, after every one asked for before it.
   *
   * @param request - What to frame, and the size of the picture.
   * @returns The picture, as a data URL.
   */
  public take(request: StillRequest): Promise<string> {
    return this.inTurn(() => this.shoot(request));
  }

  /**
   * Runs a task once every one asked for before it is done: one that fails holds up none after it.
   *
   * @param task - The task.
   * @returns What it gives.
   */
  private inTurn<Result>(task: () => Promise<Result>): Promise<Result> {
    const run = this.after(this.queue, task);
    this.queue = this.ended(run);
    return run;
  }

  /**
   * Runs a task once another is done.
   *
   * @param before - The one before, settled.
   * @param task - The task.
   * @returns What it gives.
   */
  private async after<Result>(before: Promise<void>, task: () => Promise<Result>): Promise<Result> {
    await before;
    return task();
  }

  /**
   * A task's end, whether it did or failed: whoever asked for it hears of a failure.
   *
   * @param task - The task running.
   */
  private async ended(task: Promise<unknown>): Promise<void> {
    try {
      await task;
    } catch {
      // Told to whoever asked for it; the queue goes on.
    }
  }

  /** Removes the hidden map. */
  public destroy(): void {
    this.map.remove();
    this.container.remove();
  }

  /**
   * Moves the map, waits for its tiles, and photographs it.
   *
   * @param request - What to frame, and the size of the picture.
   * @returns The picture, as a data URL.
   */
  private async shoot(request: StillRequest): Promise<string> {
    await this.loaded;
    Object.assign(this.container.style, { width: `${request.width}px`, height: `${request.height}px` });
    this.map.resize();
    const { points, padding, maxZoom } = request;
    this.map.jumpTo(
      required(this.map.cameraForBounds(required(boundsOf(points) ?? undefined, 'points to frame'), { padding, maxZoom }), 'a view of the points'),
    );
    this.drawTrack(request.track ?? []);
    await this.settled();
    return this.map.getCanvas().toDataURL(request.format ?? STILL_FORMAT, STILL_QUALITY);
  }

  /** Adds the source and layers a still's track is drawn with, on top of the basemap. */
  private installTrack(): void {
    this.map.addSource(STILL_TRACK.source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const paint: LineLayerSpecification['paint'] = { 'line-color': ['get', 'color'], 'line-width': STILL_LINE_WIDTH };
    this.map.addLayer({ id: STILL_TRACK.solid, type: 'line', source: STILL_TRACK.source, filter: ['!', ['get', 'dashed']], layout: LINE_LAYOUT, paint });
    this.map.addLayer({
      id: STILL_TRACK.dashed,
      type: 'line',
      source: STILL_TRACK.source,
      filter: ['get', 'dashed'],
      layout: { 'line-join': 'round' },
      paint: { ...paint, 'line-dasharray': [2, 1.6] },
    });
  }

  /**
   * Draws a still's track, replacing the last one's.
   *
   * @param track - Each line's track, bottom first.
   */
  private drawTrack(track: StillTrack[]): void {
    const features = track.map(line => ({
      type: 'Feature' as const,
      properties: { color: line.color, dashed: line.dashed === true },
      geometry: { type: 'MultiLineString' as const, coordinates: line.paths },
    }));
    void this.map.getSource<GeoJSONSource>(STILL_TRACK.source)?.setData({ type: 'FeatureCollection', features });
  }

  /**
   * Waits until the map has drawn every tile it needs, or for long enough.
   *
   * @returns When it has.
   */
  private settled(): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, STILL_TIMEOUT_MS);
      this.map.once('idle', () => {
        clearTimeout(timer);
        resolve();
      });
      // A map already idle fires nothing: a repaint makes it fire once more.
      this.map.triggerRepaint();
    });
  }
}
