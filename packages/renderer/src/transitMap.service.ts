import { engineOf } from '@railtime/network/engine.utils';
import type { Playhead } from '@railtime/network/facts.types';
import { Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { LAYERS } from './layers/ids.constants';
import { MapLayers } from './layers/stack.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap/minimap.service';
import { CameraDirector } from './playback/camera.service';
import { openingOf } from './playback/camera.utils';
import { Playback } from './playback/playback.service';
import { EventEmitter } from './support/eventEmitter.service';
import { PropsReconciler } from './support/reconciler.service';
import { DEFAULT_MAP_PROPS, FIT_NETWORK_MS, MAX_FRAME_SECONDS } from './transitMap.constants';
import type { Credit, FrameScheduler, MapProps, MapPropsUpdate, MapView, TransitMapEvents, TransitMapOptions } from './transitMap.types';

/** Frames from the browser, unless a test steps them by hand. */
const BROWSER_FRAMES: FrameScheduler = {
  request: frame => requestAnimationFrame(frame),
  cancel: id => cancelAnimationFrame(id),
};

/**
 * An interactive transit map with a history player: the renderer's one view (`ARCHITECTURE.md`).
 *
 * It draws a network's `NetworkFacts` at the player's moment, as its props say. Three channels, and
 * no other: props (`update`: how the map is set, the app's), commands (moving through time, camera
 * moves), and events (what happened, delivered between frames, never inside a call). A fact is asked
 * of the `NetworkFacts` it draws, never of the map. The network is a prop too: another (a plan shown,
 * or none) is drawn on the same map, with no new basemap, where the `arrival` given with it says. Made
 * with its props and listeners; `destroy` takes it all down.
 *
 * Only a facade: it owns MapLibre, the frame loop and the event queue, and hands each call on to the
 * part whose job it is: `Playback`, `CameraDirector` or `MapLayers`.
 */
export class TransitMap {
  /** The main map. */
  private readonly map: MapLibreMap;
  /** Asks for frames. */
  private readonly scheduler: FrameScheduler;
  /** The app's listeners, given with the map: the only ones it has. */
  private readonly events = new EventEmitter<TransitMapEvents>();
  /** The props, and what each does once changed. */
  private readonly props: PropsReconciler;
  /** Moves the main map's camera. */
  private readonly camera: CameraDirector;
  /** The map's layer groups. */
  private readonly layers: MapLayers;
  /** The overview inset, if the app gave it a container. */
  private readonly minimap: Minimap | null;
  /** The history played on the map, frame by frame. */
  private readonly playback: Playback;
  /** Where the map is in its life. */
  private life: 'loading' | 'ready' | 'destroyed' = 'loading';
  /** The pending frame. */
  private frameRequest = 0;
  /** When the last frame ran. */
  private lastFrameAt: number | null = null;

  public constructor(options: TransitMapOptions) {
    // Before the first map: MapLibre starts its workers with it.
    if (options.workerUrl) setWorkerUrl(options.workerUrl);
    for (const [event, listener] of Object.entries(options.on ?? {})) this.events.on(event as keyof TransitMapEvents, listener as never);
    this.scheduler = options.scheduler ?? BROWSER_FRAMES;
    // The network first: a prop's effect runs in the props' order, and every other draws on it.
    const { facts, ...given } = options.props;
    // The defaults, then what is given as `update` takes it: a prop given as `undefined` keeps its default.
    this.props = new PropsReconciler({ facts, ...DEFAULT_MAP_PROPS }, this.effects);
    this.props.update(given);
    const props = this.props.current;

    const { network, bounds } = engineOf(props.facts).index;
    const createMap = options.createMap ?? (mapOptions => new MapLibreMap(mapOptions));
    this.map = createMap({
      container: options.container,
      style: DEFAULT_BASEMAP,
      ...openingOf(options.view, bounds, props.padding, props.cover),
      attributionControl: options.attributionControl === false ? false : { compact: true, customAttribution: network.meta.attribution },
    });
    this.camera = new CameraDirector(this.map, () => this.props.current);
    this.camera.open(options.view, props.cover);
    this.layers = new MapLayers(
      this.map,
      () => engineOf(this.playback.facts),
      () => this.playback.player.clock,
    );
    const { minimapContainer } = options;
    this.minimap = minimapContainer
      ? new Minimap({ container: minimapContainer, main: this.map, createMap, style: DEFAULT_BASEMAP, bounds, palette: PALETTES[props.theme] })
      : null;
    this.playback = new Playback({
      props: () => this.props.current,
      camera: this.camera,
      layers: this.layers,
      minimap: this.minimap,
      tilesLoaded: () => this.map.areTilesLoaded(),
      notify: (event, payload) => this.events.later(event, payload),
    });

    this.map.on('style.load', () => this.install());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('moveend', () => this.events.later('view', this.camera.view));
    this.frameRequest = this.scheduler.request(this.renderFrame);
  }

  /**
   * What the map must credit on it: the basemap, then OpenStreetMap, whose data its streets and the
   * network's track are. A network's other sources are the app's to credit, off the map. Shown by the
   * app when it turns MapLibre's control off.
   */
  public get credits(): Credit[] {
    return [...DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT];
  }

  /** Where the map is in its life: loading until its style has loaded, ready, then destroyed. */
  public get status(): 'loading' | 'ready' | 'destroyed' {
    return this.life;
  }

  /**
   * Whether what the camera looks at now is drawn: the style, what was last sent to it, and the tiles in
   * view are loaded, the minimap's too. It says nothing of motion: a frame held mid-move is drawn once
   * its own tiles are, so a recorder whose clock stands still can wait for it.
   */
  public get drawn(): boolean {
    if (this.life !== 'ready') return false;
    return this.map.isStyleLoaded() === true && this.map.areTilesLoaded() && (this.minimap?.drawn ?? true);
  }

  /**
   * Whether what the camera looks at is drawn and stays so: `drawn`, the camera not moving, and no station
   * popping in or pulsing. A history playing can be settled: its clock is the app's to run, not something
   * the map does on its own.
   */
  public get settled(): boolean {
    return this.drawn && !this.map.isMoving() && !this.layers.stations.animating;
  }

  /**
   * Sets the map as the app has it: whole or in part, as often as it likes, before it is ready too.
   * The map acts on what changed (once ready: what came before is drawn then) and never changes a
   * prop itself.
   *
   * @param props - The props.
   */
  public update(props: MapPropsUpdate): void {
    if (this.alive()) this.props.update(props);
  }

  /**
   * Moves to a playhead, as a video player's seek does: playing, it plays on from there; paused, it
   * stays paused. `NetworkFacts.playheads` gives one for a day, a change, today or the end; the `time`
   * event's `TimeState` is one too.
   *
   * @param to - Where to.
   */
  public seek(to: Playhead): void {
    if (this.alive()) this.playback.seek(to);
  }

  /**
   * Plays: on from here (from the start again once at the end: history's first date, or for a network
   * with a plan, today, where its plan starts), or from a playhead.
   *
   * @param from - Where from: here, unless given.
   */
  public play(from?: Playhead): void {
    if (this.alive()) this.playback.play(from);
  }

  /** Pauses where it is. */
  public pause(): void {
    this.playback.pause();
  }

  /** Pauses, and the camera goes back to the whole network. */
  public stop(): void {
    if (!this.alive()) return;
    this.playback.pause();
    this.fitNetwork();
  }

  /** Finishes the change playing now, or goes to the next one. */
  public skip(): void {
    if (this.alive()) this.playback.skip();
  }

  /**
   * A year back or on.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    if (this.alive()) this.playback.stepYear(direction);
  }

  /** To just before the change before the one playing, or the last played: playing, it plays again. */
  public previousChange(): void {
    if (this.alive()) this.playback.previousChange();
  }

  /** Zooms in a step, about the centre. */
  public zoomIn(): void {
    if (this.alive()) this.camera.zoomIn();
  }

  /** Zooms out a step, about the centre. */
  public zoomOut(): void {
    if (this.alive()) this.camera.zoomOut();
  }

  /**
   * Fits the whole network in view.
   *
   * @param durationMs - How long the move takes.
   */
  public fitNetwork(durationMs = FIT_NETWORK_MS): void {
    if (this.alive()) this.playback.fitNetwork(durationMs);
  }

  /**
   * Moves the map to a view at once.
   *
   * @param view - The centre and zoom.
   */
  public jumpTo(view: MapView): void {
    if (this.alive()) this.camera.jumpTo(view);
  }

  /** Takes it all down: the frame loop, the map and minimap, and every listener. Later calls do nothing. */
  public destroy(): void {
    if (!this.alive()) return;
    this.life = 'destroyed';
    this.scheduler.cancel(this.frameRequest);
    this.minimap?.destroy();
    this.map.remove();
    this.events.clear();
  }

  /** What each prop does once changed (`PropsReconciler`), reading it from the props. */
  private get effects(): Record<keyof MapProps, () => void> {
    return {
      facts: () => this.playback.showNetwork(),
      // Read as `facts` changes.
      arrival: () => {},
      theme: () => {
        const { theme, streetLabels } = this.props.current;
        this.minimap?.setPalette(PALETTES[theme]);
        this.layers.applyTheme(PALETTES[theme], streetLabels);
        this.playback.redraw();
        // A route's and a reach's colours are the theme's.
        this.playback.drawOverlay();
      },
      viewMode: () => this.playback.showView(),
      stationLabels: () => this.layers.stations.showLabels(this.props.current.stationLabels),
      streetLabels: () => this.layers.showStreetLabels(this.props.current.streetLabels),
      boldPlans: () => this.layers.network.boldPlans(this.props.current.boldPlans),
      // Each frame reads it: they run on the frames' clock.
      trains: () => {},
      focusedLines: () => this.playback.applyBackdrop(),
      selectedStation: () => this.playback.select(this.props.current.selectedStation),
      overlay: () => this.playback.drawOverlay(),
      boundary: () => this.playback.drawOverlay(),
      // The player reads it each time its clock moves.
      speed: () => {},
      // The camera reads them each time it frames; a change waits as long as the camera's move to it
      // takes, a free camera's none (`Playback.focusActive`).
      camera: () => {},
      padding: () => {},
      cover: () => this.camera.coverEdges(this.props.current.cover),
    };
  }

  /**
   * Whether it is not destroyed: asked afresh, as a listener may have destroyed it meanwhile.
   *
   * @returns True until `destroy`.
   */
  private alive(): boolean {
    return this.life !== 'destroyed';
  }

  /** The style has loaded: installs the layers, then draws everything the props say, and is ready. */
  private install(): void {
    if (this.life !== 'loading') return;
    this.layers.install();
    this.life = 'ready';
    this.props.start();
    this.playback.redraw(true);
    this.events.later('status', 'ready');
  }

  /**
   * Reports the clicked station, or `null` for a click away from any.
   *
   * @param event - The map click.
   */
  private onMapClick(event: MapMouseEvent): void {
    if (this.life === 'ready') this.events.later('stationClick', this.layers.stations.stationAt(event.point));
  }

  /**
   * One frame: playback moved on and, once ready, drawn and reported; then the frame's events delivered.
   *
   * @param now - The frame time.
   */
  private readonly renderFrame = (now: number): void => {
    if (!this.alive()) return;
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - (this.lastFrameAt ?? now)) / 1000);
    this.lastFrameAt = now;
    this.playback.frame(now, seconds, this.life === 'ready');
    this.events.flush();
    // A listener may have destroyed it.
    if (this.alive()) this.frameRequest = this.scheduler.request(this.renderFrame);
  };
}
