import { Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { EventEmitter } from './support/eventEmitter.service';
import { BuildingsLayer } from './layers/buildings.service';
import { CoverageLayer } from './overlay/coverage.service';
import { ActiveStepLayer, NetworkLayer } from './layers/network.service';
import { basemapFont, recolorBasemap } from './layers/basemap.utils';
import { LAYERS } from './layers/ids.constants';
import type { MapLayer } from './layers/layer.service';
import { FrameRenderer } from './layers/frame.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap.service';
import type { NetworkEngine } from '@railtime/network/engine.service';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { NetworkTime } from '@railtime/network/facts.types';
import { OverlayController } from './overlay/controller.service';
import { ReachLayer } from './overlay/reach.service';
import { RouteLayer } from './overlay/route.service';
import { StationLayer } from './layers/stations.service';
import { PropsReconciler } from './support/reconciler.service';
import type { Step } from '@railtime/network/engine.types';
import { CameraDirector } from './playback/camera.service';
import { CAMERA_PRE_SECONDS, FREE_CAMERA_PRE_SECONDS } from './playback/player.constants';
import { Player } from './playback/player.service';
import type { PlayerEvent } from './playback/player.types';
import { StepAnimation } from './steps/animation.service';
import {
  DEFAULT_MAP_PROPS,
  END_OVERVIEW_MS,
  FIT_NETWORK_MS,
  MAX_FRAME_SECONDS,
  MAX_TILE_WAIT_SECONDS,
  SELECTED_STATION_ZOOM,
  SELECT_FLY_MS,
} from './transitMap.constants';
import type {
  Credit,
  FrameScheduler,
  MapProps,
  MapView,
  NetworkParts,
  Padding,
  PlayFrom,
  SeekTarget,
  TransitMapEvents,
  TransitMapOptions,
} from './transitMap.types';
import { openingOf } from './transitMap.utils';
import { emptyCollection } from './layers/snapshot.utils';

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
 * or none) is drawn on the same map, with no new basemap. Made with its props and listeners; `destroy` takes it all down.
 */
export class TransitMap {
  /** The basemap's style. */
  private readonly basemap: string;
  /** Everything the network drawn is drawn with, made again for another. */
  private parts: NetworkParts;
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
  /** Real seconds the playing step has waited, at the end of its camera move, for the map's tiles. */
  private tileWait = 0;

  public constructor(options: TransitMapOptions) {
    // Before the first map: MapLibre starts its workers with it.
    if (options.workerUrl) setWorkerUrl(options.workerUrl);
    for (const [event, listener] of Object.entries(options.on ?? {})) this.events.on(event as keyof TransitMapEvents, listener as never);
    this.scheduler = options.scheduler ?? BROWSER_FRAMES;
    // The network first: a prop's effect runs in the props' order, and every other draws on it.
    const { facts, ...given } = options.props;
    const props: MapProps = { facts, ...DEFAULT_MAP_PROPS, ...given };
    this.props = new PropsReconciler(props, this.effects);

    const basemap = options.basemap ?? DEFAULT_BASEMAP;
    this.basemap = basemap;
    const { network, bounds } = props.facts.engine.index;
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
      station => this.engine.index.coordOf(station),
      station => this.engine.index.stationLabel(station, this.player.clock),
      // Asked of the network drawn now: another has its own lines.
      (first, second) => this.engine.index.compareLines(first, second),
    );
    this.minimap = options.minimapContainer ? new Minimap(options.minimapContainer, basemap, bounds, PALETTES[props.theme]) : null;
    this.parts = this.partsFor(props.facts);

    this.map.on('style.load', () => this.install());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('move', () => this.updateMinimapViewport());
    this.map.on('moveend', () => this.notify('view', this.view()));
    this.frameRequest = this.scheduler.request(this.renderFrame);
  }

  /**
   * What the map must credit on it: the basemap, then OpenStreetMap, whose data its streets and the
   * network's track are. A network's other sources are the app's to credit, off the map. Shown by the
   * app when it turns MapLibre's control off.
   */
  public get credits(): Credit[] {
    // Another basemap's credits are its own business: the app keeps MapLibre's control for it.
    return [...(this.basemap === DEFAULT_BASEMAP ? DEFAULT_BASEMAP_CREDITS : []), OPENSTREETMAP_CREDIT];
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
    if (this.life !== 'destroyed') this.camera.fit(this.engine.index.bounds, Infinity, durationMs);
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
    this.events.clear();
  }

  /** The network drawn, its history and every question about it. */
  private get facts(): NetworkFacts {
    return this.parts.facts;
  }

  /** The raw network the facts come from: what it plays and draws. */
  private get engine(): NetworkEngine {
    return this.parts.facts.engine;
  }

  /** The clock and the step playing. */
  private get player(): Player {
    return this.parts.player;
  }

  /** A route, a reach or coverage over the network. */
  private get overlay(): OverlayController {
    return this.parts.overlay;
  }

  /** Draws each frame on the layers. */
  private get frames(): FrameRenderer {
    return this.parts.frames;
  }

  /**
   * What a network is drawn with: its player, at its today, the overlay worked out on it, and the
   * frames drawn of it, on the map's own layers.
   *
   * @param facts - The network.
   * @returns Its parts.
   */
  private partsFor(facts: NetworkFacts): NetworkParts {
    const { index, timeline } = facts.engine;
    const player = new Player(facts.engine, step => this.createAnimation(step));
    const overlay = new OverlayController({
      facts,
      route: this.routeLayer,
      reach: this.reachLayer,
      coverage: this.coverageLayer,
      camera: this.camera,
      moment: () => this.moment(),
      theme: () => this.props.current.theme,
      report: result => this.notify('overlay', result),
    });
    const frames = new FrameRenderer({
      index,
      timeline,
      player,
      network: this.networkLayer,
      activeStep: this.activeStepLayer,
      stations: this.stationLayer,
      minimap: this.minimap,
      baseColor: line => facts.colorOf(line)[this.props.current.theme],
    });
    return { facts, player, overlay, frames };
  }

  /** What each prop does once changed (`PropsReconciler`), reading it from the props. */
  private get effects(): Record<keyof MapProps, () => void> {
    return {
      // Another network on the same map: drawn at its today, the camera where it is, the props that
      // set its player, its lines and its overlay given to it again.
      facts: () => {
        const { facts } = this.props.current;
        if (facts === this.parts.facts) return;
        this.parts = this.partsFor(facts);
        this.tileWait = 0;
        this.minimap?.frame(facts.engine.index.bounds);
        this.minimap?.setActive(emptyCollection());
        const effects = this.effects;
        for (const effect of [effects.speed, effects.camera, effects.visibleLines, effects.overlay]) effect();
        this.jumped();
      },
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
        this.frames.visibleLines = new Set(this.props.current.visibleLines ?? this.engine.index.lineIds);
        this.frames.redraw();
      },
      focusedLines: () => this.applyBackdrop(),
      selectedStation: () => {
        const station = this.props.current.selectedStation;
        this.selectionAway = false;
        this.stationLayer.select(station);
        if (station) this.camera.flyTo(this.engine.index.coordOf(station), SELECTED_STATION_ZOOM, SELECT_FLY_MS);
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
    this.queue.push(() => this.events.emit(event, payload));
  }

  /** Delivers the events raised since the last frame, in order. */
  private flush(): void {
    const events = this.queue;
    this.queue = [];
    for (const deliver of events) deliver();
  }

  /**
   * The moment the map shows, for the network's questions.
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
  private createAnimation(step: Step): StepAnimation {
    const { index, timeline } = this.engine;
    return new StepAnimation(step, { index, timeline, view: this.props.current.viewMode });
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
    this.tileWait = 0;
    const speed = this.player.speed;
    const { index, timeline } = this.engine;
    const moveMs = this.camera.focusStep(
      active.animation,
      timeline.stationsOnMap(this.player.cursor),
      station => index.coordOf(station),
      (active.preSeconds * 1000) / speed,
    );
    // At once, after a beat, where it stays.
    this.player.retimeLeadIn(moveMs === 0 ? FREE_CAMERA_PRE_SECONDS : (moveMs / 1000) * speed);
    this.notify('step', this.facts.change(active.animation.step.index));
  }

  /**
   * Clears the caption when the next step is on another date.
   *
   * @param step - The step that ended.
   */
  private onStepEnd(step: Step): void {
    this.frames.redraw();
    const next = this.engine.timeline.steps[step.index + 1];
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
    this.handlePlayerEvents(this.player.tick(this.waitsForTiles(seconds) ? 0 : seconds));
    if (this.life === 'ready') this.draw(now, seconds);
    this.flush();
    // A listener may have destroyed it.
    if (this.alive()) this.frameRequest = this.scheduler.request(this.renderFrame);
  };

  /**
   * Whether the playing step waits this frame for the map's tiles: as its camera move ends, where the
   * camera arrived is not drawn yet (a jump across the city, at street level, on a sharp screen), and
   * it has not waited `MAX_TILE_WAIT_SECONDS` already. The line then starts growing over streets, not
   * a blank that fills in as it goes.
   *
   * @param seconds - The time since the last frame.
   * @returns Whether to hold the step this frame.
   */
  private waitsForTiles(seconds: number): boolean {
    const active = this.player.active;
    if (!active || !this.player.playing || this.life !== 'ready') return false;
    const arriving = active.elapsed < active.preSeconds && active.elapsed + seconds * this.player.speed >= active.preSeconds;
    if (!arriving || this.tileWait >= MAX_TILE_WAIT_SECONDS || this.map.areTilesLoaded()) return false;
    this.tileWait += seconds;
    return true;
  }

  /**
   * Draws the frame; hides the ring of a selected station the moment took off the map, and says so.
   *
   * @param now - The frame time.
   * @param seconds - The time since the last frame.
   */
  private draw(now: number, seconds: number): void {
    const selected = this.props.current.selectedStation;
    const { revealed, selectionGone, chase } = this.frames.draw(now, selected);
    this.camera.follow(chase, seconds);
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
