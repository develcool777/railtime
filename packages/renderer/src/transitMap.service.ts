import { Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { EventEmitter } from './core/eventEmitter.service';
import { BuildingsLayer } from './buildings/layer.service';
import { CoverageLayer } from './coverage/layer.service';
import { ActiveStepLayer } from './layers/activeStep.service';
import { basemapFont, recolorBasemap } from './layers/basemap.utils';
import { LAYERS } from './layers/ids.constants';
import type { MapLayer } from './layers/layer.service';
import { NetworkLayer } from './layers/network.service';
import { FrameRenderer } from './layers/frame.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap/map.service';
import type { NetworkModel } from '@railtime/network/model.service';
import type { NetworkTime } from '@railtime/network/model.types';
import { OverlayController } from './overlay/controller.service';
import { ReachLayer } from './reach/layer.service';
import { RouteLayer } from './route/layer.service';
import { StationLayer } from './stations/layer.service';
import { PropsReconciler } from './state/reconciler.service';
import type { Step } from '@railtime/network/timeline.types';
import { CameraDirector } from './playback/camera.service';
import { CAMERA_PRE_SECONDS, FREE_CAMERA_PRE_SECONDS } from './playback/player.constants';
import { Player } from './playback/player.service';
import type { PlayerEvent } from './playback/player.types';
import { createStepAnimation } from './steps/animation.utils';
import { DEFAULT_MAP_PROPS, END_OVERVIEW_MS, FIT_NETWORK_MS, MAX_FRAME_SECONDS, SELECTED_STATION_ZOOM, SELECT_FLY_MS } from './transitMap.constants';
import type { Credit, FrameScheduler, MapProps, MapView, Padding, PlayFrom, SeekTarget, TransitMapEvents, TransitMapOptions } from './transitMap.types';
import { openingOf } from './transitMap.utils';

/** Frames from the browser, unless a test steps them by hand. */
const BROWSER_FRAMES: FrameScheduler = {
  request: frame => requestAnimationFrame(frame),
  cancel: id => cancelAnimationFrame(id),
};

/**
 * An interactive transit map with a history player: the renderer's one view (`_ARCHITECTURE.md`).
 *
 * It draws a `NetworkModel` at the player's moment, as its props say. Four channels, and no other:
 * props (`update`: how the map is set, the app's), commands (moving through time, camera moves),
 * events (what happened, delivered between frames, never inside a call), and the model's own
 * questions. Made with its props and listeners; `destroy` takes it all down.
 */
export class TransitMap extends EventEmitter<TransitMapEvents> {
  /** What the map owes credit to: the basemap, then the network's data. Shown by the app when it turns MapLibre's control off. */
  public readonly credits: Credit[];
  /** The network, its history and every question about it. */
  private readonly model: NetworkModel;
  /** The clock and the step playing. */
  private readonly player: Player;
  /** The main map. */
  private readonly map: MapLibreMap;
  /** Asks for frames. */
  private readonly scheduler: FrameScheduler;
  /** The props, and what each does once changed. */
  private readonly props: PropsReconciler;
  /** Moves the main map's camera. */
  private readonly camera: CameraDirector;
  /** The network already on the map. */
  private readonly networkLayer: NetworkLayer;
  /** What the playing step draws. */
  private readonly activeStepLayer: ActiveStepLayer;
  /** Stations, labels, pulses and the selection ring. */
  private readonly stationLayer: StationLayer;
  /** A route over the network. */
  private readonly routeLayer: RouteLayer;
  /** How far one gets from a station. */
  private readonly reachLayer: ReachLayer;
  /** How much of the city is near a station. */
  private readonly coverageLayer: CoverageLayer;
  /** The basemap's buildings, standing in 3D. */
  private readonly buildingsLayer: BuildingsLayer;
  /** A route, a reach or coverage over the network. */
  private readonly overlay: OverlayController;
  /** Draws each frame on the layers. */
  private readonly frames: FrameRenderer;
  /** The overview inset, if the app gave it a container. */
  private readonly minimap: Minimap | null;
  /** Events raised since the last frame, delivered at its end. */
  private queue: (() => void)[] = [];
  /** Where the map is in its life. */
  private life: 'loading' | 'ready' | 'destroyed' = 'loading';
  /** The selected station is off the map at the moment shown: its ring hidden until it is back. */
  private selectionAway = false;
  /** The pending frame. */
  private frameRequest = 0;
  /** When the last frame ran. */
  private lastFrameAt = 0;

  public constructor(options: TransitMapOptions) {
    super();
    // Before the first map: MapLibre starts its workers with it.
    if (options.workerUrl) setWorkerUrl(options.workerUrl);
    for (const [event, listener] of Object.entries(options.on ?? {})) this.on(event as keyof TransitMapEvents, listener as never);
    this.model = options.model;
    this.player = new Player(this.model, step => this.createAnimation(step));
    this.scheduler = options.scheduler ?? BROWSER_FRAMES;
    const props: MapProps = { ...DEFAULT_MAP_PROPS, ...options.props };
    this.props = new PropsReconciler(props, this.effects);

    const basemap = options.basemap ?? DEFAULT_BASEMAP;
    const { network, bounds } = this.model.index;
    // Another basemap's credits are its own business: the app keeps MapLibre's control for it.
    this.credits = [...(basemap === DEFAULT_BASEMAP ? DEFAULT_BASEMAP_CREDITS : []), { text: network.meta.attribution }];
    const createMap = options.createMap ?? (mapOptions => new MapLibreMap(mapOptions));
    this.map = createMap({
      container: options.container,
      style: basemap,
      ...openingOf(options.view, bounds, props.padding, props.cover),
      attributionControl: options.attributionControl === false ? false : { compact: true, customAttribution: network.meta.attribution },
    });
    // A linked view's centre was the middle of what the cover left; a fitted opening already keeps clear of it.
    if (options.view) this.map.setPadding(props.cover);
    else this.coverEdges(props.cover);
    this.camera = new CameraDirector(this.map, () => this.props.current);
    this.networkLayer = new NetworkLayer(this.map);
    this.activeStepLayer = new ActiveStepLayer(this.map);
    this.routeLayer = new RouteLayer(this.map);
    this.reachLayer = new ReachLayer(this.map);
    this.coverageLayer = new CoverageLayer(this.map);
    this.buildingsLayer = new BuildingsLayer(this.map);
    this.stationLayer = new StationLayer(
      this.map,
      station => this.model.index.coordOf(station),
      station => this.model.index.stationLabel(station, this.player.clock),
      this.model.index.compareLines,
    );
    this.overlay = new OverlayController({
      model: this.model,
      route: this.routeLayer,
      reach: this.reachLayer,
      coverage: this.coverageLayer,
      camera: this.camera,
      moment: () => this.moment(),
      theme: () => this.props.current.theme,
      report: result => this.notify('overlay', result),
    });
    this.minimap = options.minimapContainer ? new Minimap(options.minimapContainer, basemap, bounds, PALETTES[props.theme]) : null;
    this.frames = new FrameRenderer({
      index: this.model.index,
      timeline: this.model.timeline,
      player: this.player,
      network: this.networkLayer,
      activeStep: this.activeStepLayer,
      stations: this.stationLayer,
      minimap: this.minimap,
      baseColor: line => this.model.colorOf(line, this.props.current.theme),
    });

    this.map.on('style.load', () => this.install());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('move', () => this.updateMinimapViewport());
    this.map.on('moveend', () => this.notify('view', this.view()));
    this.frameRequest = this.scheduler.request(this.renderFrame);
  }

  /** Where the map is in its life: loading until its style has loaded, ready, then destroyed. */
  public get status(): 'loading' | 'ready' | 'destroyed' {
    return this.life;
  }

  /**
   * Sets the map as the app has it: whole or in part, as often as it likes, before it is ready too.
   * The map acts on what changed (once ready: what came before is drawn then) and never changes a
   * prop itself.
   *
   * @param props - The props.
   */
  public update(props: Partial<MapProps>): void {
    if (this.life !== 'destroyed') this.props.update(props);
  }

  /**
   * Moves through time as a video player's seek does: playing, it plays on from there; paused, it
   * stays paused. The future, where every change has played, pauses.
   *
   * @param to - A day, just after a change or just before one, today, or the future.
   */
  public seek(to: SeekTarget): void {
    if (this.life === 'destroyed') return;
    this.player.seek(to);
    this.jumped();
  }

  /**
   * Plays: on from here (from the start again once at the end), from history's start (for a network
   * with a plan, today, where its future starts), or from a change.
   *
   * @param from - Where from.
   */
  public play(from: PlayFrom = 'here'): void {
    if (this.life === 'destroyed') return;
    this.player.play(from);
    if (from !== 'here') this.jumped();
  }

  /** Pauses where it is. */
  public pause(): void {
    this.player.pause();
  }

  /** Pauses, and the camera goes back to the whole network. */
  public stop(): void {
    if (this.life === 'destroyed') return;
    this.player.pause();
    this.fitNetwork();
  }

  /** Finishes the change playing now, or goes to the next one. */
  public skip(): void {
    if (this.life !== 'destroyed') this.handlePlayerEvents(this.player.skip());
  }

  /**
   * A year back or on.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    if (this.life === 'destroyed') return;
    this.player.stepYear(direction);
    this.jumped();
  }

  /** To just before the change before the one playing, or the last played: playing, it plays again. */
  public previousChange(): void {
    if (this.life === 'destroyed') return;
    this.player.previousChange();
    this.jumped();
  }

  /** Zooms in a step, about the centre. */
  public zoomIn(): void {
    if (this.life !== 'destroyed') this.map.zoomIn();
  }

  /** Zooms out a step, about the centre. */
  public zoomOut(): void {
    if (this.life !== 'destroyed') this.map.zoomOut();
  }

  /**
   * Fits the whole network in view.
   *
   * @param durationMs - How long the move takes.
   */
  public fitNetwork(durationMs = FIT_NETWORK_MS): void {
    if (this.life !== 'destroyed') this.camera.fit(this.model.index.bounds, Infinity, durationMs);
  }

  /**
   * Moves the map to a view at once.
   *
   * @param view - The centre and zoom.
   */
  public jumpTo(view: MapView): void {
    if (this.life !== 'destroyed') this.map.jumpTo({ center: view.center, zoom: view.zoom });
  }

  /** Takes it all down: the frame loop, the map and minimap, and every listener. Later calls do nothing. */
  public destroy(): void {
    if (this.life === 'destroyed') return;
    this.life = 'destroyed';
    this.scheduler.cancel(this.frameRequest);
    this.queue = [];
    this.minimap?.destroy();
    this.map.remove();
    this.removeAllListeners();
  }

  /** What each prop does once changed (`PropsReconciler`), reading it from the props. */
  private get effects(): Record<keyof MapProps, () => void> {
    return {
      theme: () => {
        const palette = PALETTES[this.props.current.theme];
        this.minimap?.setPalette(palette);
        recolorBasemap(this.map, palette, { labels: true });
        for (const layer of this.layers) layer.applyPalette(palette);
        this.frames.redraw();
        // A route's and a reach's colours are the theme's.
        this.drawOverlay();
      },
      // Into 3D the buildings rise and the camera comes down to them; back, it lies flat and faces north.
      viewMode: () => {
        this.buildingsLayer.show(this.props.current.viewMode === '3d');
        this.camera.tilt();
      },
      stationLabels: () => this.stationLayer.showLabels(this.props.current.stationLabels),
      visibleLines: () => {
        this.frames.visibleLines = new Set(this.props.current.visibleLines ?? this.model.index.lineIds);
        this.frames.redraw();
      },
      focusedLines: () => this.applyBackdrop(),
      selectedStation: () => {
        const station = this.props.current.selectedStation;
        this.selectionAway = false;
        this.stationLayer.select(station);
        if (station) this.camera.flyTo(this.model.index.coordOf(station), SELECTED_STATION_ZOOM, SELECT_FLY_MS);
      },
      overlay: () => this.drawOverlay(),
      boundary: () => this.drawOverlay(),
      speed: () => this.player.setSpeed(this.props.current.speed),
      // A free camera does not move, so a step needs no time before it to frame it.
      camera: () => this.player.setLeadIn(this.props.current.camera === 'free' ? FREE_CAMERA_PRE_SECONDS : CAMERA_PRE_SECONDS),
      // The camera reads it each time it frames.
      padding: () => undefined,
      cover: () => this.coverEdges(this.props.current.cover),
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

  /** The layer groups, bottom to top. */
  private get layers(): MapLayer[] {
    return [this.coverageLayer, this.buildingsLayer, this.networkLayer, this.activeStepLayer, this.stationLayer, this.routeLayer, this.reachLayer];
  }

  /**
   * Raises an event, delivered at the end of the frame: never inside a call.
   *
   * @param event - The event.
   * @param payload - What it says.
   */
  private notify<Name extends keyof TransitMapEvents>(event: Name, payload: TransitMapEvents[Name]): void {
    this.queue.push(() => this.emit(event, payload));
  }

  /** Delivers the events raised since the last frame, in order. */
  private flush(): void {
    const events = this.queue;
    this.queue = [];
    for (const deliver of events) deliver();
  }

  /**
   * The moment the map shows, for the model's questions.
   *
   * @returns The cursor and the clock.
   */
  private moment(): NetworkTime {
    return { cursor: this.player.cursor, time: this.player.clock };
  }

  /**
   * Where the map looks now.
   *
   * @returns Its centre and zoom.
   */
  private view(): MapView {
    const { lng, lat } = this.map.getCenter();
    return { center: [lng, lat], zoom: this.map.getZoom() };
  }

  /** Draws the overlay the props ask for, and the network behind it. */
  private drawOverlay(): void {
    const { overlay, boundary } = this.props.current;
    this.overlay.draw(overlay, boundary);
    this.applyBackdrop();
  }

  /** Fades the network behind a route or a reach; else brings forward the lines in focus. */
  private applyBackdrop(): void {
    const backdrop = this.overlay.backdrop;
    this.networkLayer.focus(backdrop ? [] : this.props.current.focusedLines);
    this.stationLayer.fade(backdrop);
  }

  /**
   * Lays the app's panels over the map's edges. The map's centre, where a station is flown to, moves
   * into the middle of the rest, and every frame keeps clear of them; what is drawn stays where it is,
   * so a panel slides over the map without moving it.
   *
   * @param cover - Pixels covered on each side.
   */
  private coverEdges(cover: Padding): void {
    const { clientWidth, clientHeight } = this.map.getContainer();
    const middle: [number, number] = [cover.left + (clientWidth - cover.left - cover.right) / 2, cover.top + (clientHeight - cover.top - cover.bottom) / 2];
    this.map.jumpTo({ center: this.map.unproject(middle), padding: cover });
  }

  /** The style has loaded: installs the layers, then draws everything the props say, and is ready. */
  private install(): void {
    if (this.life !== 'loading') return;
    const font = basemapFont(this.map);
    for (const layer of this.layers) layer.install(font);
    this.life = 'ready';
    this.props.start();
    this.frames.redraw(true);
    this.updateMinimapViewport();
    this.notify('status', 'ready');
  }

  /**
   * Reports the clicked station, or `null` for a click away from any.
   *
   * @param event - The map click.
   */
  private onMapClick(event: MapMouseEvent): void {
    if (this.life === 'ready') this.notify('stationClick', this.stationLayer.stationAt(event.point));
  }

  /**
   * Builds a step's animation as the network stands at its cursor.
   *
   * @param step - The step.
   * @returns Its animation.
   */
  private createAnimation(step: Step): ReturnType<typeof createStepAnimation> {
    const { index, timeline } = this.model;
    return createStepAnimation(step, { index, timeline, stationsBefore: timeline.stationsOnMap(step.index), view: this.props.current.viewMode });
  }

  /** Redraws at once after a jump in time, nothing pulsing and no caption. */
  private jumped(): void {
    this.stationLayer.resetPulses();
    this.frames.redraw(true);
    this.notify('step', null);
  }

  /**
   * Reacts to what the player did.
   *
   * @param events - The player's events.
   */
  private handlePlayerEvents(events: PlayerEvent[]): void {
    for (const event of events) {
      if (event.type === 'stepStart') this.onStepStart();
      else if (event.type === 'stepEnd') this.onStepEnd(event.step);
      else this.onPlaybackEnd();
    }
  }

  /** Frames a starting step and announces it: the change starts drawing as the camera arrives. */
  private onStepStart(): void {
    const active = this.player.active;
    if (!active) return;
    this.frames.stepStarted();
    const speed = this.player.speed;
    const { index, timeline } = this.model;
    const moveMs = this.camera.focusStep(
      active.animation,
      timeline.stationsOnMap(this.player.cursor),
      station => index.coordOf(station),
      (active.preSeconds * 1000) / speed,
    );
    // At once, after a beat, where it stays.
    this.player.retimeLeadIn(moveMs === 0 ? FREE_CAMERA_PRE_SECONDS : (moveMs / 1000) * speed);
    this.notify('step', this.model.change(active.animation.step.index, this.props.current.theme));
  }

  /**
   * Clears the caption when the next step is on another date.
   *
   * @param step - The step that ended.
   */
  private onStepEnd(step: Step): void {
    this.frames.redraw();
    const next = this.model.timeline.steps[step.index + 1];
    if (!next || next.time !== step.time) this.notify('step', null);
  }

  /** Playback reached its end: the whole network in view. */
  private onPlaybackEnd(): void {
    this.notify('step', null);
    this.notify('end', undefined);
    this.fitNetwork(END_OVERVIEW_MS);
  }

  /**
   * One frame: advance playback; once ready, draw what changed, follow the date with the overlay and
   * report the time; then deliver the frame's events.
   *
   * @param now - The frame time.
   */
  private readonly renderFrame = (now: number): void => {
    if (this.life === 'destroyed') return;
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - (this.lastFrameAt || now)) / 1000);
    this.lastFrameAt = now;
    this.handlePlayerEvents(this.player.tick(seconds));
    if (this.life === 'ready') this.draw(now, seconds);
    this.flush();
    // A listener may have destroyed it.
    if (this.alive()) this.frameRequest = this.scheduler.request(this.renderFrame);
  };

  /**
   * Draws the frame; hides the ring of a selected station the moment took off the map, and says so.
   *
   * @param now - The frame time.
   * @param seconds - The time since the last frame.
   */
  private draw(now: number, seconds: number): void {
    const selected = this.props.current.selectedStation;
    const { revealed, selectionGone, tips } = this.frames.draw(now, selected);
    this.camera.follow(tips, seconds);
    if (revealed !== null) this.notify('stepProgress', revealed);
    if (selected && selectionGone !== this.selectionAway) {
      this.selectionAway = selectionGone;
      this.stationLayer.select(selectionGone ? null : selected);
      if (selectionGone) this.notify('selectionGone', selected);
    }
    // The overlay first, so the app hears of the new date with what the overlay came to on it.
    const { overlay, boundary } = this.props.current;
    this.overlay.follow(overlay, boundary);
    const time = this.frames.timeState();
    if (time) this.notify('time', time);
  }

  /** Outlines the main camera's view on the minimap. */
  private updateMinimapViewport(): void {
    if (!this.minimap) return;
    const bounds = this.map.getBounds();
    this.minimap.setViewport([
      [bounds.getWest(), bounds.getSouth()],
      [bounds.getEast(), bounds.getNorth()],
    ]);
  }
}
