import { Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { EventEmitter } from './core/eventEmitter.service';
import { buildPlan } from '@railtime/schema/plan.utils';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { BuildingsLayer } from './buildings/layer.service';
import { CoverageLayer } from './coverage/layer.service';
import { CoverageMeasure } from './coverage/measure.service';
import { ActiveStepLayer } from './layers/activeStep.service';
import { basemapFont, recolorBasemap } from './layers/basemap.utils';
import { NetworkQueries } from './network/queries.service';
import type { NetworkMoment } from './network/queries.types';
import { reachStops, reachTrack } from './reach/layer.utils';
import { routeStops, routeTrack } from './route/layer.utils';
import { LAYERS } from './layers/ids.constants';
import type { MapLayer } from './layers/layer.service';
import { NetworkLayer } from './layers/network.service';
import { ReachLayer } from './reach/layer.service';
import { RouteLayer } from './route/layer.service';
import { FrameRenderer } from './layers/frame.service';
import { StationLayer } from './stations/layer.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap/map.service';
import { todayTimestamp } from './core/date.utils';
import { boundsOf } from './core/geometry.utils';
import { overlaySubjectOf } from './overlay/request.utils';
import { stateChanges } from './state/changes.utils';
import { NetworkIndex } from './network/index.service';
import { Timeline } from './network/timeline.service';
import type { Step } from './network/timeline.types';
import { CameraDirector } from './playback/camera.service';
import { CAMERA_PRE_SECONDS, FREE_CAMERA_PRE_SECONDS } from './playback/player.constants';
import { Player } from './playback/player.service';
import type { ActivePlayback, PlayerEvent } from './playback/player.types';
import { createStepAnimation, describeSteps } from './steps/animation.utils';
import {
  END_OVERVIEW_MS,
  DEFAULT_MAP_STATE,
  FIT_NETWORK_MS,
  MAX_FRAME_SECONDS,
  OPENING_MAX_ZOOM,
  SELECTED_STATION_ZOOM,
  SELECT_FLY_MS,
  ROUTE_NAME_ROOM,
} from './transitMap.constants';
import type {
  ChangeInfo,
  CoverageInfo,
  CoverageYear,
  Credit,
  LineDetails,
  LineInfo,
  MapView,
  Padding,
  NetworkGrowth,
  MapState,
  NetworkRecords,
  ReachInfo,
  RouteInfo,
  RoutePreference,
  StationInfo,
  StationSummary,
  TransitMapEvents,
  TransitMapOptions,
} from './transitMap.types';
import { openingOf } from './transitMap.utils';

/**
 * An interactive transit map with a history player: the renderer's one public entry.
 *
 * Give it a normalized `Network`. It draws the network on a MapLibre basemap as of any date
 * (`setDate`), or plays its history step by step (`play`). It owns the map and nothing else: the app
 * around it owns every control and caption, calling methods here and listening to events.
 */
export class TransitMap extends EventEmitter<TransitMapEvents> {
  /** What the map owes credit to: the basemap, then the network's data. Shown by the app when it turns MapLibre's control off. */
  public readonly credits: Credit[];
  /** The network, indexed for drawing. */
  private readonly index: NetworkIndex;
  /** The network's history as steps. */
  private readonly timeline: Timeline;
  /** The clock and the step playing. */
  private readonly player: Player;
  /** The main map. */
  private readonly map: MapLibreMap;
  /** Moves the main map's camera during playback. */
  private readonly camera: CameraDirector;
  /** The network already on the map. */
  private readonly networkLayer: NetworkLayer;
  /** What the playing step draws. */
  private readonly activeStepLayer: ActiveStepLayer;
  /** Stations, labels, pulses and the selection ring. */
  private readonly stationLayer: StationLayer;
  /** A route over the network, when one is shown. */
  private readonly routeLayer: RouteLayer;
  /** Answers the app's questions about the network: lines, stations, routes, reach, records. */
  private readonly queries: NetworkQueries;
  /** How far one gets from a station, when it is shown. */
  private readonly reachLayer: ReachLayer;
  /** How much of the city is within walking distance of a station, when it is shown. */
  private readonly coverageLayer: CoverageLayer;
  /** The city's coverage on the network; `null` until the app gives the city's outline. */
  private coverage: CoverageMeasure | null = null;
  /** The cursor the overlay was last worked out at: it is worked out again when the date moves on. */
  private overlayCursor = -1;
  /** What the overlay the camera last framed was of: it frames a new one, and leaves the view be as the date changes. */
  private overlayFramed: string | null = null;
  /** The basemap's buildings, standing when the map is seen in 3D. */
  private readonly buildingsLayer: BuildingsLayer;
  /** Draws each frame on the layers. */
  private readonly frames: FrameRenderer;
  /** The overview inset, if the app gave it a container. */
  private readonly minimap: Minimap | null;
  /** How the map is set, as last applied (`apply`). */
  private state: MapState;
  /** The basemap has loaded and the overlay is installed. */
  private ready = false;
  /** The pending animation frame. */
  private frameRequest = 0;
  /** When the last frame ran. */
  private lastFrameAt = 0;

  public constructor(options: TransitMapOptions) {
    super();
    // Before the first map: MapLibre starts its workers with it.
    if (options.workerUrl) setWorkerUrl(options.workerUrl);
    const plan = options.plan ? buildPlan(options.network, options.plan) : null;
    this.index = new NetworkIndex(plan?.network ?? options.network, plan?.sections);
    this.timeline = new Timeline(this.index);
    this.player = new Player(this.timeline, todayTimestamp(), step => this.createAnimation(step));
    // What it opens with: the rest of the state is applied once the map is made, as any change is.
    const opening = { ...DEFAULT_MAP_STATE, ...options.state };
    this.state = { ...DEFAULT_MAP_STATE, theme: opening.theme, padding: opening.padding, cover: opening.cover };

    const basemap = options.basemap ?? DEFAULT_BASEMAP;
    // Another basemap's credits are its own business: the app keeps MapLibre's control for it.
    this.credits = [...(basemap === DEFAULT_BASEMAP ? DEFAULT_BASEMAP_CREDITS : []), { text: options.network.meta.attribution }];
    const { padding, cover } = this.state;
    this.map = new MapLibreMap({
      container: options.container,
      style: basemap,
      ...openingOf(options.view, this.index.bounds, padding, cover),
      attributionControl: options.attributionControl === false ? false : { compact: true, customAttribution: options.network.meta.attribution },
    });
    // A linked view's centre was the middle of what the cover left; a fitted opening already keeps clear of it.
    if (options.view) this.map.setPadding(cover);
    else this.coverEdges(cover);
    this.camera = new CameraDirector(this.map, padding);
    this.networkLayer = new NetworkLayer(this.map);
    this.activeStepLayer = new ActiveStepLayer(this.map);
    this.routeLayer = new RouteLayer(this.map);
    this.reachLayer = new ReachLayer(this.map);
    this.coverageLayer = new CoverageLayer(this.map);
    this.buildingsLayer = new BuildingsLayer(this.map);
    this.queries = new NetworkQueries(this.index, this.timeline, this.player.today);
    this.stationLayer = new StationLayer(
      this.map,
      station => this.index.coordOf(station),
      station => this.index.stationLabel(station, this.player.clock),
      this.index.compareLines,
    );
    this.minimap = options.minimapContainer ? new Minimap(options.minimapContainer, basemap, this.index.bounds, PALETTES[this.state.theme]) : null;
    this.frames = new FrameRenderer({
      index: this.index,
      timeline: this.timeline,
      player: this.player,
      network: this.networkLayer,
      activeStep: this.activeStepLayer,
      stations: this.stationLayer,
      minimap: this.minimap,
      baseColor: line => this.baseColor(line),
    });

    this.map.on('style.load', () => this.installOverlay());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('move', () => this.updateMinimapViewport());
    this.map.on('moveend', () => this.emit('view', this.getView()));
    this.apply(opening);
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  }

  /** The first and last dates the timeline covers, and today, as timestamps. A plan's future has no date: it plays at `end`. */
  public get range(): { start: number; end: number; today: number } {
    return { start: this.timeline.start, end: this.player.end, today: this.player.today };
  }

  /**
   * Sets the map as the app has it: acts on the parts that changed, and on nothing however often it
   * is given the same. What each part does is in `effects`.
   *
   * @param next - The state, whole or in part.
   */
  public apply(next: Partial<MapState>): void {
    const changes = stateChanges(this.state, next);
    this.state = { ...this.state, ...changes };
    for (const key of Object.keys(changes) as (keyof MapState)[]) this.effects[key]();
  }

  /**
   * Shows the network as it was at the end of a day. A seek, as a video player's: playing, it plays on
   * from there; paused, it stays paused.
   *
   * @param time - A timestamp on that day.
   */
  public setDate(time: number): void {
    this.player.seek(time);
    this.jumped();
  }

  /** Shows the network with its plan built: every step played, planned ones too. Stops playback. */
  public showFuture(): void {
    this.player.playing = false;
    this.player.seekEnd();
    this.jumped();
  }

  /**
   * Shows the network just after a change, on its date. A seek, as `setDate`: playing, it plays on.
   *
   * @param index - The change's position, from `getChanges`.
   */
  public showChange(index: number): void {
    this.player.seekPast(index);
    this.jumped();
  }

  /**
   * Plays on from a change, starting it now.
   *
   * @param index - The change's position, from `getChanges`.
   */
  public playFrom(index: number): void {
    this.player.seekBefore(index);
    this.jumped();
    this.player.playing = true;
  }

  /**
   * Every change in the timeline, planned ones last, described as its caption will be.
   *
   * @returns The changes, in the order they play, coloured for the current theme.
   */
  public getChanges(): ChangeInfo[] {
    return describeSteps({ index: this.index, timeline: this.timeline, visibleLines: new Set(this.index.lineIds), baseColor: line => this.baseColor(line) });
  }

  /** Plays history from the current date; from the start if already at today. */
  public play(): void {
    if (this.player.cursor >= this.timeline.steps.length && this.player.clock >= this.player.end) this.player.seek(this.timeline.start);
    this.player.playing = true;
  }

  /** Pauses playback where it is. */
  public pause(): void {
    this.player.playing = false;
  }

  /** Finishes the change playing now, or jumps to the next one. */
  public skip(): void {
    this.handlePlayerEvents(this.player.skip());
  }

  /** Zooms in a step, about the centre. */
  public zoomIn(): void {
    this.map.zoomIn();
  }

  /** Zooms out a step, about the centre. */
  public zoomOut(): void {
    this.map.zoomOut();
  }

  /**
   * Where the map looks now.
   *
   * @returns Its centre and zoom.
   */
  public getView(): MapView {
    const { lng, lat } = this.map.getCenter();
    return { center: [lng, lat], zoom: this.map.getZoom() };
  }

  /**
   * Moves the map to a view at once.
   *
   * @param view - The centre and zoom.
   */
  public setView(view: MapView): void {
    this.map.jumpTo({ center: view.center, zoom: view.zoom });
  }

  /**
   * Fits the whole network in view.
   *
   * @param durationMs - How long the move takes.
   */
  public fitNetwork(durationMs = FIT_NETWORK_MS): void {
    this.camera.fit(this.index.bounds, Infinity, durationMs);
  }

  /**
   * Every line a user can toggle, with its colour in the current theme.
   *
   * @returns The lines, in the network's order.
   */
  public getLines(): LineInfo[] {
    return this.queries.lines(line => this.baseColor(line));
  }

  /**
   * A line on the date shown: its stops in order, by branch, how long it is, and the changes that
   * made it.
   *
   * @param line - The line id.
   * @returns The line's details.
   */
  public getLineDetails(line: string): LineDetails {
    return this.queries.lineDetails(line, this.moment());
  }

  /**
   * The best route between two stations on the date shown: the lines to ride, where to change, and
   * about how long it takes.
   *
   * @param from - The station to start at.
   * @param to - The station to get to.
   * @param preference - Fastest (the default), or fewer changes.
   * @returns The route, or `null` if the network of the date has none.
   */
  public findRoute(from: string, to: string, preference: RoutePreference = 'fastest'): RouteInfo | null {
    return this.queries.route(from, to, preference, this.moment());
  }

  /**
   * The network year by year up to this one, and how many stations opened in each decade.
   *
   * @returns Its growth.
   */
  public getGrowth(): NetworkGrowth {
    return this.queries.growth();
  }

  /**
   * The network's records on the date shown: the stations open longest, those most lines call at,
   * and the longest lines.
   *
   * @param count - How many of each.
   * @returns The records.
   */
  public getRecords(count = 5): NetworkRecords {
    return this.queries.records(count, this.moment());
  }

  /**
   * How long it takes to get from a station to every other on the date shown, by the fastest routes.
   *
   * @param from - The station to start at.
   * @returns The stations it gets to, soonest first, and the bands they are coloured in; `null` if no line calls there on the date.
   */
  public findReach(from: string): ReachInfo | null {
    return this.queries.reach(from, this.moment());
  }

  /**
   * Gives the city's outline, which coverage is measured within; `null` for a city without one.
   *
   * @param boundary - The outline.
   */
  public setBoundary(boundary: CityBoundary | null): void {
    this.coverage = boundary ? new CoverageMeasure(boundary, this.index, this.timeline) : null;
    if (this.state.overlay?.kind === 'coverage') this.overlayFramed = null;
    this.drawOverlay();
  }

  /**
   * How much of the city is within walking distance of a station open on the date shown.
   *
   * @returns The share in each band and within the headline distance; `null` without an outline.
   */
  public findCoverage(): CoverageInfo | null {
    return this.coverage?.info(this.player.cursor) ?? null;
  }

  /**
   * The share of the city within the headline distance of a station, at the end of each year up to this one.
   *
   * @returns A share for each year, oldest first; none without an outline.
   */
  public getCoverageHistory(): CoverageYear[] {
    return this.coverage?.history(this.player.today) ?? [];
  }

  /**
   * The stations on the map on the date shown, for a search: each with its names and its lines' colours.
   *
   * @returns The stations, by name.
   */
  public getStations(): StationSummary[] {
    return this.queries.stations(this.moment());
  }

  /**
   * A station's lines, with when each opened there and, if it has, closed: its track, or its calls
   * there while the track stays.
   *
   * @param station - The station id.
   * @returns The station's details.
   */
  public getStationInfo(station: string): StationInfo {
    return this.queries.stationInfo(station, this.moment());
  }

  /** Stops rendering and removes the map, the minimap and every listener. */
  public destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.minimap?.destroy();
    this.map.remove();
    this.removeAllListeners();
  }

  /** What each part of the state does once changed, reading it from `state`. */
  private readonly effects: Record<keyof MapState, () => void> = {
    theme: () => {
      this.minimap?.setPalette(PALETTES[this.state.theme]);
      if (this.ready) this.applyPalette();
      this.frames.redraw();
      // A route's and a reach's colours are the theme's.
      if (this.state.overlay) this.drawOverlay();
      this.emit('theme', this.state.theme);
    },
    // Into 3D the buildings rise and the camera comes down to them; back, it lies flat and faces north.
    viewMode: () => {
      this.buildingsLayer.show(this.state.viewMode === '3d');
      this.camera.setViewMode(this.state.viewMode);
    },
    stationLabels: () => this.stationLayer.showLabels(this.state.stationLabels),
    visibleLines: () => {
      this.frames.visibleLines = new Set(this.state.visibleLines ?? this.index.lineIds);
      this.frames.redraw();
    },
    focusedLines: () => {
      if (this.ready) this.applyBackdrop();
    },
    selectedStation: () => {
      const station = this.state.selectedStation;
      if (!this.ready) return;
      this.stationLayer.select(station);
      if (station) this.map.easeTo({ center: this.index.coordOf(station), zoom: Math.max(this.map.getZoom(), SELECTED_STATION_ZOOM), duration: SELECT_FLY_MS });
    },
    overlay: () => this.drawOverlay(),
    speed: () => (this.player.speed = this.state.speed),
    // A free camera does not move, so a step needs no time before it to frame it.
    camera: () => {
      this.camera.mode = this.state.camera;
      this.player.preSeconds = this.state.camera === 'free' ? FREE_CAMERA_PRE_SECONDS : CAMERA_PRE_SECONDS;
    },
    padding: () => (this.camera.padding = this.state.padding),
    cover: () => this.coverEdges(this.state.cover),
  };

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

  /**
   * Where the map stands, for a question about the network.
   *
   * @returns The cursor, the clock and the theme's colours.
   */
  private moment(): NetworkMoment {
    return { cursor: this.player.cursor, clock: this.player.clock, colorOf: line => this.baseColor(line) };
  }

  /** The overlay's layer groups, bottom to top. */
  private get layers(): MapLayer[] {
    return [this.coverageLayer, this.buildingsLayer, this.networkLayer, this.activeStepLayer, this.stationLayer, this.routeLayer, this.reachLayer];
  }

  /**
   * Works out the overlay asked for on the date shown, draws it (clearing the others), frames it if it
   * is of something new, and says what it came to.
   */
  private drawOverlay(): void {
    const request = this.state.overlay;
    const cursor = this.player.cursor;
    this.overlayCursor = cursor;
    const route = request?.kind === 'route' ? this.findRoute(request.from, request.to, request.preference) : null;
    const reach = request?.kind === 'reach' ? this.findReach(request.from) : null;
    const coverage = request?.kind === 'coverage' ? this.coverage : null;
    const routeLine = routeTrack(this.index, route);
    const reachStations = reachStops(this.index, reach);
    this.routeLayer.update(routeLine, routeStops(this.index, route));
    this.reachLayer.update(reachTrack(this.index, this.timeline, cursor, reach), reachStations);
    this.coverageLayer.update(coverage ? coverage.drawing(cursor) : null);
    if (this.ready) this.applyBackdrop();

    const subject = overlaySubjectOf(request);
    if (subject !== this.overlayFramed) {
      // A route keeps room for its names; coverage frames the whole city, as a reach frames what it gets to.
      const routeBounds = route && boundsOf(routeLine.flatMap(feature => feature.geometry.coordinates));
      const reachBounds = reach && boundsOf(reachStations.map(stop => stop.geometry.coordinates));
      if (routeBounds) this.camera.fit(routeBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS, ROUTE_NAME_ROOM);
      else if (reachBounds) this.camera.fit(reachBounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS);
      else if (coverage) this.camera.fit(coverage.bounds, OPENING_MAX_ZOOM, SELECT_FLY_MS);
      // Framed once there is something to frame: coverage waits for the outline, a route for the date to have one.
      if (route || reach || coverage || !request) this.overlayFramed = subject;
    }

    if (request?.kind === 'route') this.emit('overlay', { kind: 'route', route });
    else if (request?.kind === 'reach') this.emit('overlay', { kind: 'reach', reach });
    else if (request?.kind === 'coverage') this.emit('overlay', { kind: 'coverage', coverage: coverage?.info(cursor) ?? null });
    else this.emit('overlay', null);
  }

  /** Fades the network behind a route or a reach shown; else brings forward the lines in focus. */
  private applyBackdrop(): void {
    const backdrop = this.routeLayer.shown || this.reachLayer.shown;
    this.networkLayer.focus(backdrop ? [] : this.state.focusedLines);
    this.stationLayer.fade(backdrop);
  }

  /** Recolours the basemap and installs the overlay once the style has loaded. */
  private installOverlay(): void {
    const font = basemapFont(this.map);
    for (const layer of this.layers) layer.install(font);
    this.applyPalette();
    // A station selected before the style loaded (from a link) gets its ring now; a route, a reach or coverage drew as installed.
    this.stationLayer.select(this.state.selectedStation);
    this.applyBackdrop();
    this.ready = true;
    this.frames.redraw(true);
    this.updateMinimapViewport();
    this.emit('ready', undefined);
  }

  /** Applies the theme's palette to the basemap and every overlay layer. */
  private applyPalette(): void {
    const palette = PALETTES[this.state.theme];
    recolorBasemap(this.map, palette, { labels: true });
    for (const layer of this.layers) layer.applyPalette(palette);
  }

  /**
   * Reports the clicked station, or `null` for a click away from any.
   *
   * @param event - The map click.
   */
  private onMapClick(event: MapMouseEvent): void {
    this.emit('stationClick', this.stationLayer.stationAt(event.point));
  }

  /**
   * A line's own colour in the current theme.
   *
   * @param line - The line id.
   * @returns Its colour.
   */
  private baseColor(line: string): string {
    const info = this.index.lineOf(line);
    return (this.state.theme === 'dark' && info.darkColor) || info.color;
  }

  /**
   * Builds a step's animation as the network stands at its cursor.
   *
   * @param step - The step.
   * @returns Its animation.
   */
  private createAnimation(step: Step): ReturnType<typeof createStepAnimation> {
    return createStepAnimation(step, {
      index: this.index,
      timeline: this.timeline,
      stationsBefore: this.timeline.stationsOnMap(step.index),
      view: this.camera.viewMode,
    });
  }

  /** Redraws at once after the player jumped, nothing pulsing and no caption. */
  private jumped(): void {
    this.stationLayer.resetPulses();
    this.frames.redraw(true);
    this.emit('step', null);
  }

  /**
   * Reacts to what the player did.
   *
   * @param events - The player's events.
   */
  private handlePlayerEvents(events: PlayerEvent[]): void {
    for (const event of events) {
      if (event.type === 'stepStart') this.onStepStart(event.playback);
      else if (event.type === 'stepEnd') this.onStepEnd(event.step);
      else this.onPlaybackEnd();
    }
  }

  /**
   * Frames a starting step and announces it.
   *
   * @param playback - The step that started.
   */
  private onStepStart(playback: ActivePlayback): void {
    this.frames.stepStarted();
    const speed = this.player.speed;
    const moveMs = this.camera.focusStep(
      playback.animation,
      this.timeline.stationsOnMap(this.player.cursor),
      station => this.index.coordOf(station),
      (playback.preSeconds * 1000) / speed,
    );
    // The change starts as the camera arrives: at once, after a beat, where it stays.
    playback.preSeconds = moveMs === 0 ? FREE_CAMERA_PRE_SECONDS : (moveMs / 1000) * speed;
    this.emit('step', playback.animation.describe(this.frames.renderState()));
  }

  /**
   * Clears the caption when the next step is on another date.
   *
   * @param step - The step that ended.
   */
  private onStepEnd(step: Step): void {
    this.frames.redraw();
    const next = this.timeline.steps[step.index + 1];
    if (!next || next.time !== step.time) this.emit('step', null);
  }

  /** Playback reached today: show the whole network. */
  private onPlaybackEnd(): void {
    this.emit('step', null);
    this.emit('end', undefined);
    this.fitNetwork(END_OVERVIEW_MS);
  }

  /**
   * One frame: advance playback, redraw what changed, report the time.
   *
   * @param now - The frame time.
   */
  private readonly renderFrame = (now: number): void => {
    const seconds = Math.min(MAX_FRAME_SECONDS, (now - (this.lastFrameAt || now)) / 1000);
    this.lastFrameAt = now;
    this.handlePlayerEvents(this.player.tick(seconds));
    if (this.ready) this.draw(now, seconds);
    this.emitTime();
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  };

  /**
   * Draws the frame, and tells the app of the playing step's stations, and of a selection the date
   * took off the map.
   *
   * @param now - The frame time.
   * @param seconds - The time since the last frame.
   */
  private draw(now: number, seconds: number): void {
    const { revealed, selectionGone, tips } = this.frames.draw(now, this.state.selectedStation);
    this.camera.follow(tips, seconds);
    if (revealed !== null) this.emit('stepProgress', revealed);
    const gone = this.state.selectedStation;
    if (selectionGone && gone) {
      // Its ring goes now; the app hears of it and stops asking for it.
      this.state = { ...this.state, selectedStation: null };
      this.stationLayer.select(null);
      this.emit('selectionGone', gone);
    }
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

  /** Emits `time` when the clock's day, the cursor, the playing state or the stats change. */
  private emitTime(): void {
    // The overlay first, so the app hears of the new date with what the overlay came to on it.
    if (this.state.overlay && this.player.cursor !== this.overlayCursor) this.drawOverlay();
    const state = this.frames.timeState();
    if (state) this.emit('time', state);
  }
}
