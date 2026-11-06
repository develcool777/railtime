import type { NetworkEngine } from '@railtime/network/engine.service';
import type { Step } from '@railtime/network/engine.types';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead } from '@railtime/network/facts.types';
import { Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { basemapFont, recolorBasemap, showBasemapLabels } from './layers/basemap.utils';
import { BuildingsLayer } from './layers/buildings.service';
import { FrameRenderer } from './layers/frame.service';
import { LAYERS } from './layers/ids.constants';
import type { MapLayer } from './layers/layer.service';
import { ActiveStepLayer, NetworkLayer } from './layers/network.service';
import { emptyCollection } from './layers/snapshot.utils';
import { StationLayer } from './layers/stations.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, OPENSTREETMAP_CREDIT, PALETTES } from './layers/theme.constants';
import { TrainLayer } from './layers/trains.service';
import { Minimap } from './minimap/minimap.service';
import { OverlayController } from './overlay/controller.service';
import { CoverageLayer } from './overlay/coverage.service';
import { ReachLayer } from './overlay/reach.service';
import { RouteLayer } from './overlay/route.service';
import { CameraDirector } from './playback/camera.service';
import { Playback } from './playback/playback.service';
import { Player } from './playback/player.service';
import { StepAnimation } from './steps/animation.service';
import { EventEmitter } from './support/eventEmitter.service';
import { PropsReconciler } from './support/reconciler.service';
import { DEFAULT_MAP_PROPS, FIT_NETWORK_MS, MAX_FRAME_SECONDS, SELECTED_STATION_ZOOM, SELECT_FLY_MS } from './transitMap.constants';
import type { Credit, FrameScheduler, MapProps, MapPropsUpdate, MapView, NetworkParts, Padding, TransitMapEvents, TransitMapOptions } from './transitMap.types';
import { openingOf } from './transitMap.utils';

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
  /** Trains running on the lines, when turned on. */
  private readonly trainLayer: TrainLayer;
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
    this.trainLayer = new TrainLayer(this.map);
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
    const { minimapContainer } = options;
    this.minimap = minimapContainer
      ? new Minimap({ container: minimapContainer, main: this.map, createMap, style: basemap, bounds, palette: PALETTES[props.theme] })
      : null;
    this.parts = this.partsFor(props.facts);
    this.playback = new Playback({
      parts: () => this.parts,
      props: () => this.props.current,
      camera: this.camera,
      stations: this.stationLayer,
      tilesLoaded: () => this.map.areTilesLoaded(),
      fitNetwork: durationMs => this.fitNetwork(durationMs),
      notify: (event, payload) => this.events.later(event, payload),
    });

    this.map.on('style.load', () => this.install());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('moveend', () => this.events.later('view', this.view()));
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
  public update(props: MapPropsUpdate): void {
    if (this.life !== 'destroyed') this.props.update(props);
  }

  /**
   * Moves to a playhead, as a video player's seek does: playing, it plays on from there; paused, it
   * stays paused. `NetworkFacts.playheads` gives one for a day, a change, today or the end; the `time`
   * event's `TimeState` is one too.
   *
   * @param to - Where to.
   */
  public seek(to: Playhead): void {
    if (this.life === 'destroyed') return;
    this.player.seek(to);
    this.playback.jumped();
  }

  /**
   * Plays: on from here (from the start again once at the end: history's first date, or for a network
   * with a plan, today, where its plan starts), or from a playhead.
   *
   * @param from - Where from: here, unless given.
   */
  public play(from?: Playhead): void {
    if (this.life === 'destroyed') return;
    this.player.play(from);
    if (from) this.playback.jumped();
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
    if (this.life !== 'destroyed') this.playback.handle(this.player.skip());
  }

  /**
   * A year back or on.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    if (this.life === 'destroyed') return;
    this.player.stepYear(direction);
    this.playback.jumped();
  }

  /** To just before the change before the one playing, or the last played: playing, it plays again. */
  public previousChange(): void {
    if (this.life === 'destroyed') return;
    this.player.previousChange();
    this.playback.jumped();
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
    this.minimap?.destroy();
    this.map.remove();
    this.events.clear();
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
      moment: () => this.player.playhead,
      theme: () => this.props.current.theme,
      report: result => this.events.later('overlay', result),
    });
    const frames = new FrameRenderer({
      index,
      timeline,
      playheads: facts.engine.playheads,
      player,
      network: this.networkLayer,
      activeStep: this.activeStepLayer,
      trains: this.trainLayer,
      trainService: cursor => facts.engine.trainService(cursor),
      showTrains: () => this.props.current.trains,
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
        this.minimap?.frame(facts.engine.index.bounds);
        this.minimap?.setActive(emptyCollection());
        this.player.setSpeed(this.props.current.speed);
        this.drawOverlay();
        this.playback.jumped();
      },
      theme: () => {
        const palette = PALETTES[this.props.current.theme];
        this.minimap?.setPalette(palette);
        recolorBasemap(this.map, palette, { labels: this.props.current.streetLabels });
        for (const layer of this.layers) layer.applyPalette(palette);
        this.frames.redraw();
        // A route's and a reach's colours are the theme's.
        this.drawOverlay();
      },
      // Into 3D the buildings rise and the camera comes down to them; back, it lies flat and faces north.
      // The change playing goes on as now seen, from as far as it had got: in 3D the camera rides along it
      // from where it has grown to, or, still on its way there, flies to where it starts. (Back flat, it
      // only lies flat: framing it then would cut the tilt short.)
      viewMode: () => {
        const view = this.props.current.viewMode;
        this.buildingsLayer.show(view === '3d');
        this.player.rebuild();
        this.camera.tilt(this.frames.growing());
        if (view === '3d' && this.player.phase === 'pre') this.playback.focusActive();
      },
      stationLabels: () => this.stationLayer.showLabels(this.props.current.stationLabels),
      streetLabels: () => showBasemapLabels(this.map, this.props.current.streetLabels),
      // Each frame reads it: they run on the frames' clock.
      trains: () => {},
      focusedLines: () => this.applyBackdrop(),
      selectedStation: () => {
        const station = this.props.current.selectedStation;
        this.playback.select(station);
        if (station) this.camera.flyTo(this.engine.index.coordOf(station), SELECTED_STATION_ZOOM, SELECT_FLY_MS);
      },
      overlay: () => this.drawOverlay(),
      boundary: () => this.drawOverlay(),
      speed: () => this.player.setSpeed(this.props.current.speed),
      // The camera reads them each time it frames; a change waits as long as the camera's move to it
      // takes, a free camera's none (`Playback.focusActive`).
      camera: () => {},
      padding: () => {},
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
    return [
      this.coverageLayer,
      this.buildingsLayer,
      this.networkLayer,
      this.activeStepLayer,
      this.trainLayer,
      this.stationLayer,
      this.routeLayer,
      this.reachLayer,
    ];
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
    this.trainLayer.focus(backdrop ? [] : this.props.current.focusedLines);
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
    this.events.later('status', 'ready');
  }

  /**
   * Reports the clicked station, or `null` for a click away from any.
   *
   * @param event - The map click.
   */
  private onMapClick(event: MapMouseEvent): void {
    if (this.life === 'ready') this.events.later('stationClick', this.stationLayer.stationAt(event.point));
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

  /**
   * One frame: playback moved on and, once ready, drawn and reported; then the frame's events delivered.
   *
   * @param now - The frame time.
   */
  private readonly renderFrame = (now: number): void => {
    if (this.life === 'destroyed') return;
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - (this.lastFrameAt ?? now)) / 1000);
    this.lastFrameAt = now;
    this.playback.frame(now, seconds, this.life === 'ready');
    this.events.flush();
    // A listener may have destroyed it.
    if (this.alive()) this.frameRequest = this.scheduler.request(this.renderFrame);
  };
}
