import { type LngLatBoundsLike, Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { EventEmitter } from './core/eventEmitter.service';
import { buildPlan } from '@railtime/schema/plan.utils';
import { required } from './core/required.utils';
import { ActiveStepLayer } from './layers/activeStepLayer.service';
import { basemapFont, recolorBasemap } from './layers/basemap.utils';
import type { PointFeature, ReachStopProperties, ReachTrackFeature, RouteFeature, RouteStopProperties, StationLines } from './layers/features.types';
import { pointFeature } from './layers/features.utils';
import { routeStopMarks } from './layers/routeStops.utils';
import type { RenderState } from './layers/lineStyle.types';
import { LAYERS } from './layers/layers.constants';
import type { MapLayer } from './layers/mapLayer.service';
import { NetworkLayer } from './layers/networkLayer.service';
import { REACH_BANDS } from './layers/reach.constants';
import { bandOf, reachedSegments } from './layers/reach.utils';
import { ReachLayer } from './layers/reachLayer.service';
import { RouteLayer } from './layers/routeLayer.service';
import type { NetworkSnapshot } from './layers/networkSnapshot.types';
import { buildNetworkSnapshot } from './layers/networkSnapshot.utils';
import { StationLayer } from './layers/stationLayer.service';
import { DEFAULT_BASEMAP, DEFAULT_BASEMAP_CREDITS, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap/minimap.service';
import { DAY_MS, toIsoDate, toTimestamp, todayTimestamp } from './model/date.utils';
import { lineBranches, lineLengthKm, stepChangesLine } from './model/lineDetails.utils';
import { boundsOf } from './model/geometry.utils';
import type { NetworkHistory } from './model/history.types';
import { networkAt, networkHistory, openingsByDecade } from './model/history.utils';
import { NetworkIndex } from './model/networkIndex.service';
import type { TrackSegment } from './model/networkIndex.types';
import { RouteFinder } from './model/routeFinder.service';
import { Timeline } from './model/timeline.service';
import type { Step } from './model/timeline.types';
import { CameraDirector } from './playback/camera.service';
import { clamp } from './playback/easing.utils';
import { CAMERA_PRE_SECONDS, FREE_CAMERA_PRE_SECONDS } from './playback/player.constants';
import { Player } from './playback/player.service';
import type { ActivePlayback, PlayerEvent } from './playback/player.types';
import type { StepDrawing } from './steps/stepAnimation.types';
import { createStepAnimation, describeSteps, emptyDrawing } from './steps/stepAnimation.utils';
import {
  DEFAULT_PADDING,
  NO_COVER,
  END_OVERVIEW_MS,
  FIT_NETWORK_MS,
  MAX_FRAME_SECONDS,
  NEW_LABEL_FADE_FRACTION,
  OPENING_MAX_ZOOM,
  OPENING_SIDE_PADDING,
  SELECTED_STATION_ZOOM,
  SELECT_FLY_MS,
  ROUTE_NAME_ROOM,
} from './transitMap.constants';
import type {
  CameraMode,
  ChangeInfo,
  Credit,
  LineDetails,
  LineInfo,
  MapView,
  Padding,
  NetworkGrowth,
  NetworkRecords,
  ReachInfo,
  RouteInfo,
  RoutePreference,
  StationInfo,
  StationSummary,
  Theme,
  TimeState,
  TransferInfo,
  TransitMapEvents,
  TransitMapOptions,
} from './transitMap.types';

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
  /** Finds routes between stations. */
  private readonly routeFinder: RouteFinder;
  /** The route drawn, kept so the overlay can draw it again once installed. */
  private route: RouteFeature[] = [];
  /** Its stops, marked. */
  private routeStops: PointFeature<RouteStopProperties>[] = [];
  /** How far one gets from a station, when it is shown. */
  private readonly reachLayer: ReachLayer;
  /** The reach's track drawn, kept so the overlay can draw it again once installed. */
  private reachTrack: ReachTrackFeature[] = [];
  /** The stations the reach drawn gets to, its start among them. */
  private reachStops: PointFeature<ReachStopProperties>[] = [];
  /** The network year by year, worked out the first time it is asked for: it does not change. */
  private history: NetworkHistory | null = null;
  /** The station the reach drawn starts at: the camera frames a reach when it changes. */
  private reachFrom: string | null = null;
  /** The overview inset, if the app gave it a container. */
  private readonly minimap: Minimap | null;
  /** The map's colour theme. */
  private theme: Theme;
  /** Lines the user has toggled on. */
  private visibleLines: Set<string>;
  /** The basemap has loaded and the overlay is installed. */
  private ready = false;
  /** Everything already on the map at the cursor. */
  private snapshot: NetworkSnapshot | null = null;
  /** The snapshot needs rebuilding: the cursor, toggles or theme changed. */
  private snapshotStale = true;
  /** The next frame shows stations without their pop-in. */
  private instant = true;
  /** How many of the playing step's new stations have appeared. */
  private revealedCount = 0;
  /** The station ringed on the map. */
  private selectedStation: string | null = null;
  /** The lines brought forward, the rest faded; `null` when every line is. */
  private focusedLines: string[] | null = null;
  /** Clock day, cursor and playing state at the last `time` event, to emit only on change. */
  private lastTimeKey = '';
  /** The minimap was last sent a non-empty active drawing. */
  private minimapShowsActive = false;
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
    this.theme = options.theme ?? 'dark';
    this.visibleLines = new Set(this.index.lineIds);

    const basemap = options.basemap ?? DEFAULT_BASEMAP;
    // Another basemap's credits are its own business: the app keeps MapLibre's control for it.
    this.credits = [...(basemap === DEFAULT_BASEMAP ? DEFAULT_BASEMAP_CREDITS : []), { text: options.network.meta.attribution }];
    const padding = options.padding ?? DEFAULT_PADDING;
    const cover = { ...NO_COVER, ...options.cover };
    const opening = options.view
      ? { center: options.view.center, zoom: options.view.zoom }
      : {
          bounds: this.index.bounds as LngLatBoundsLike,
          // Clear of the title and playback bar; the sides stay narrow, as their panels are small until playback.
          fitBoundsOptions: {
            padding: {
              top: padding.top + cover.top,
              bottom: padding.bottom + cover.bottom,
              left: OPENING_SIDE_PADDING + cover.left,
              right: OPENING_SIDE_PADDING + cover.right,
            },
            maxZoom: OPENING_MAX_ZOOM,
          },
        };
    this.map = new MapLibreMap({
      container: options.container,
      style: basemap,
      ...opening,
      attributionControl: options.attributionControl === false ? false : { compact: true, customAttribution: options.network.meta.attribution },
    });
    // A linked view's centre was the middle of what the cover left; a fitted opening already keeps clear of it.
    if (options.view) this.map.setPadding(cover);
    else this.setCover(cover);
    this.camera = new CameraDirector(this.map, padding);
    this.networkLayer = new NetworkLayer(this.map);
    this.activeStepLayer = new ActiveStepLayer(this.map);
    this.routeLayer = new RouteLayer(this.map);
    this.reachLayer = new ReachLayer(this.map);
    this.routeFinder = new RouteFinder(this.index, this.timeline);
    this.stationLayer = new StationLayer(
      this.map,
      station => this.index.coordOf(station),
      station => this.index.stationLabel(station, this.player.clock),
      this.index.compareLines,
    );
    this.minimap = options.minimapContainer ? new Minimap(options.minimapContainer, basemap, this.index.bounds, PALETTES[this.theme]) : null;

    this.map.on('style.load', () => this.installOverlay());
    this.map.on('click', event => this.onMapClick(event));
    this.map.on('mouseenter', LAYERS.stations, () => (this.map.getCanvas().style.cursor = 'pointer'));
    this.map.on('mouseleave', LAYERS.stations, () => (this.map.getCanvas().style.cursor = ''));
    this.map.on('move', () => this.updateMinimapViewport());
    this.map.on('moveend', () => this.emit('view', this.getView()));
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  }

  /** The first and last dates the timeline covers, and today, as timestamps. A plan's future has no date: it plays at `end`. */
  public get range(): { start: number; end: number; today: number } {
    return { start: this.timeline.start, end: this.player.end, today: this.player.today };
  }

  /**
   * Shows the network as it was at the end of a day. Stops playback.
   *
   * @param time - A timestamp on that day.
   */
  public setDate(time: number): void {
    this.player.playing = false;
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
   * Shows the network just after a change, on its date. Stops playback.
   *
   * @param index - The change's position, from `getChanges`.
   */
  public showChange(index: number): void {
    this.player.playing = false;
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

  /**
   * Sets the playback speed.
   *
   * @param speed - A multiplier: 1 is normal speed.
   */
  public setSpeed(speed: number): void {
    this.player.speed = speed;
  }

  /**
   * Sets how the camera follows playback.
   *
   * @param mode - The camera mode.
   */
  public setCameraMode(mode: CameraMode): void {
    this.camera.mode = mode;
    this.player.preSeconds = mode === 'free' ? FREE_CAMERA_PRE_SECONDS : CAMERA_PRE_SECONDS;
  }

  /**
   * Sets the room the app's panels take up.
   *
   * @param padding - Pixels to keep clear on each side.
   */
  public setPadding(padding: Padding): void {
    this.camera.padding = padding;
  }

  /**
   * Sets the panels the app lays over the map's edges. The map's centre, where a station is flown
   * to, moves into the middle of the rest, and every frame keeps clear of them; what is drawn stays
   * where it is, so a panel slides over the map without moving it.
   *
   * @param cover - Pixels covered on each side; a side left out is uncovered.
   */
  public setCover(cover: Partial<Padding>): void {
    const next = { ...NO_COVER, ...cover };
    const { clientWidth, clientHeight } = this.map.getContainer();
    const middle: [number, number] = [next.left + (clientWidth - next.left - next.right) / 2, next.top + (clientHeight - next.top - next.bottom) / 2];
    this.map.jumpTo({ center: this.map.unproject(middle), padding: next });
  }

  /**
   * Switches the colour theme of the basemap, lines and minimap.
   *
   * @param theme - The theme.
   */
  public setTheme(theme: Theme): void {
    this.theme = theme;
    this.minimap?.setPalette(PALETTES[theme]);
    if (this.ready) this.applyPalette();
    this.snapshotStale = true;
  }

  /**
   * Shows only some lines.
   *
   * @param lineIds - The lines to show.
   */
  public setVisibleLines(lineIds: string[]): void {
    this.visibleLines = new Set(lineIds);
    this.snapshotStale = true;
  }

  /**
   * Brings some lines forward and fades the rest, as for a line's panel; `null` shows every line
   * alike. A route shown fades every line behind it, whatever this asks.
   *
   * @param lineIds - The lines to bring forward, or `null`.
   */
  public focusLines(lineIds: string[] | null): void {
    this.focusedLines = lineIds;
    if (this.ready) this.applyBackdrop();
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
   * Names the stations on the map, or shows only their dots.
   *
   * @param shown - Whether to name them.
   */
  public setStationLabels(shown: boolean): void {
    this.stationLayer.showLabels(shown);
  }

  /**
   * Rings a station and flies to it, or clears the selection.
   *
   * @param station - The station id, or `null`.
   */
  public selectStation(station: string | null): void {
    this.selectedStation = station;
    if (!this.ready) return;
    this.stationLayer.select(station);
    if (station) this.map.easeTo({ center: this.index.coordOf(station), zoom: Math.max(this.map.getZoom(), SELECTED_STATION_ZOOM), duration: SELECT_FLY_MS });
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
    return this.index.lineIds.map(id => {
      const line = this.index.lineOf(id);
      return {
        id,
        name: line.name,
        network: line.network,
        networkName: required(this.index.network.networks[line.network], `network ${line.network}`).name,
        color: this.baseColor(id),
        opened: Number.isFinite(this.index.lineOpens(id)) ? this.index.lineOpens(id) : null,
      };
    });
  }

  /**
   * A line on the date shown: its stops in order, by branch, how long it is, and the changes that
   * made it.
   *
   * @param line - The line id.
   * @returns The line's details.
   */
  public getLineDetails(line: string): LineDetails {
    const info = required(
      this.getLines().find(candidate => candidate.id === line),
      `line ${line}`,
    );
    const cursor = this.player.cursor;
    const branches = lineBranches(this.index, this.timeline, line, cursor).map(run =>
      run.map(station => ({ id: station, name: this.index.stationName(station, this.player.clock) })),
    );
    return {
      ...info,
      stations: new Set(branches.flatMap((run, position) => (position === 0 ? run : run.slice(1))).map(stop => stop.id)).size,
      km: lineLengthKm(this.index, this.timeline, line, cursor),
      branches,
      changes: this.timeline.steps.filter(step => stepChangesLine(step, line)).map(step => step.index),
    };
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
    const route = this.routeFinder.find(from, to, this.player.cursor, preference);
    if (!route) return null;
    const stop = (station: string) => ({ id: station, name: this.index.stationName(station, this.player.clock) });
    return {
      from: stop(from),
      to: stop(to),
      legs: route.legs.map(leg =>
        leg.kind === 'walk'
          ? { kind: 'walk', from: stop(leg.from), to: stop(leg.to), minutes: leg.minutes }
          : {
              kind: 'ride',
              line: leg.line,
              lineName: this.index.lineName(leg.line),
              color: this.baseColor(leg.line),
              stops: leg.stops.map(stop),
              minutes: leg.minutes,
              km: leg.km,
            },
      ),
      minutes: route.minutes,
      km: route.km,
      changes: route.changes,
      segments: route.legs.map(leg => (leg.kind === 'ride' ? leg.segments : [])),
    };
  }

  /**
   * Draws a route over the network and frames it, or clears it. While one is shown the network is
   * its backdrop: every line faded, the stations faded and unnamed; the route's own stops are marked
   * on it, its start, changes and end named.
   *
   * @param route - A route `findRoute` gave, or `null`.
   */
  public showRoute(route: RouteInfo | null): void {
    this.route = (route?.legs ?? []).flatMap((leg, position): RouteFeature[] => {
      if (leg.kind === 'walk') {
        return [
          {
            type: 'Feature',
            properties: { color: '', walk: true },
            geometry: { type: 'LineString', coordinates: [this.index.coordOf(leg.from.id), this.index.coordOf(leg.to.id)] },
          },
        ];
      }
      return (route?.segments[position] ?? []).map(segment => ({
        type: 'Feature',
        properties: { color: leg.color, walk: false },
        geometry: { type: 'LineString', coordinates: required(this.index.segments[segment], `segment ${segment}`).coordinates },
      }));
    });
    this.routeStops = route
      ? routeStopMarks(route).map(mark => pointFeature(this.index.coordOf(mark.station), { kind: mark.kind, color: mark.color, name: mark.name }))
      : [];
    if (this.ready) {
      this.routeLayer.update(this.route, this.routeStops);
      this.applyBackdrop();
    }
    const bounds = boundsOf(this.route.flatMap(feature => feature.geometry.coordinates));
    if (bounds) this.camera.fit(bounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS, ROUTE_NAME_ROOM);
  }

  /**
   * The network year by year up to this one, and how many stations opened in each decade.
   *
   * @returns Its growth.
   */
  public getGrowth(): NetworkGrowth {
    const { years, firstYears } = this.networkHistory();
    return { years, decades: openingsByDecade(firstYears) };
  }

  /**
   * The network's records on the date shown: the stations open longest, those most lines call at,
   * and the longest lines.
   *
   * @param count - How many of each.
   * @returns The records.
   */
  public getRecords(count = 5): NetworkRecords {
    const cursor = this.player.cursor;
    const { firstYears } = this.networkHistory();
    const { stations } = networkAt(this.index, this.timeline, cursor);
    const name = (station: string) => this.index.stationName(station, this.player.clock);
    const oldest = [...stations.keys()]
      .flatMap(station => {
        const year = firstYears.get(station);
        return year === undefined ? [] : [{ id: station, name: name(station), year }];
      })
      .sort((first, second) => first.year - second.year || first.name.localeCompare(second.name))
      .slice(0, count);
    const busiest = [...stations]
      .map(([station, lines]) => ({
        id: station,
        name: name(station),
        lines: [...lines].sort(this.index.compareLines).map(line => ({ id: line, name: this.index.lineName(line), color: this.baseColor(line) })),
      }))
      .sort((first, second) => second.lines.length - first.lines.length || first.name.localeCompare(second.name))
      .slice(0, count);
    const longest = this.index.lineIds
      .map(line => ({ id: line, name: this.index.lineName(line), color: this.baseColor(line), km: lineLengthKm(this.index, this.timeline, line, cursor) }))
      .filter(line => line.km > 0)
      .sort((first, second) => second.km - first.km)
      .slice(0, count);
    return { oldest, busiest, longest };
  }

  /**
   * How long it takes to get from a station to every other on the date shown, by the fastest routes.
   *
   * @param from - The station to start at.
   * @returns The stations it gets to, soonest first, and the bands they are coloured in; `null` if no line calls there on the date.
   */
  public findReach(from: string): ReachInfo | null {
    const minutes = this.routeFinder.reach(from, this.player.cursor);
    if (minutes.size === 0) return null;
    const name = (station: string) => this.index.stationName(station, this.player.clock);
    // The search reaches stations soonest first, so they come in that order.
    const stations = [...minutes].filter(([station]) => station !== from).map(([id, time]) => ({ id, name: name(id), minutes: time, band: bandOf(time) }));
    return { from: { id: from, name: name(from) }, stations, bands: REACH_BANDS };
  }

  /**
   * Draws how far one gets from a station, or clears it: the track and the stations in the colour of
   * how long they take, each named with its time where there is room, over the network faded as
   * behind a route. A new start is framed with all it reaches.
   *
   * @param reach - A reach `findReach` gave, or `null`.
   */
  public showReach(reach: ReachInfo | null): void {
    const minutes = new Map<string, number>(reach ? [[reach.from.id, 0], ...reach.stations.map(station => [station.id, station.minutes] as const)] : []);
    const open = new Map<number, TrackSegment>();
    for (const lineSegment of this.index.lineSegments) {
      if (this.timeline.isOpen(lineSegment, this.player.cursor)) open.set(lineSegment.segment.index, lineSegment.segment);
    }
    this.reachTrack = reachedSegments(minutes, open.values()).map(({ segment, minutes: time }) => ({
      type: 'Feature',
      properties: { color: required(REACH_BANDS[bandOf(time)], 'reach band').color },
      geometry: { type: 'LineString', coordinates: required(this.index.segments[segment], `segment ${segment}`).coordinates },
    }));
    this.reachStops = reach
      ? [
          pointFeature(this.index.coordOf(reach.from.id), {
            color: required(REACH_BANDS[0], 'reach band').color,
            label: reach.from.name,
            minutes: 0,
            origin: true,
          }),
          ...reach.stations.map(station =>
            pointFeature(this.index.coordOf(station.id), {
              color: required(REACH_BANDS[station.band], 'reach band').color,
              label: `${station.name} · ${Math.round(station.minutes)} min`,
              minutes: station.minutes,
              origin: false,
            }),
          ),
        ]
      : [];
    if (this.ready) {
      this.reachLayer.update(this.reachTrack, this.reachStops);
      this.applyBackdrop();
    }
    const from = reach?.from.id ?? null;
    if (from !== null && from !== this.reachFrom) {
      const bounds = boundsOf(this.reachStops.map(stop => stop.geometry.coordinates));
      if (bounds) this.camera.fit(bounds, SELECTED_STATION_ZOOM, SELECT_FLY_MS);
    }
    this.reachFrom = from;
  }

  /**
   * The stations on the map on the date shown, for a search: each with its names and its lines' colours.
   *
   * @returns The stations, by name.
   */
  public getStations(): StationSummary[] {
    const cursor = this.player.cursor;
    return (
      [...this.timeline.stationsOnMap(cursor)]
        .map(station => {
          const lines = [
            ...new Set(
              this.index
                .lineSegmentsAt(station)
                .filter(lineSegment => this.timeline.isOpen(lineSegment, cursor) && this.timeline.servesStation(station, lineSegment.line, cursor))
                .map(lineSegment => lineSegment.line),
            ),
          ].sort(this.index.compareLines);
          return {
            id: station,
            name: this.index.stationName(station, this.player.clock),
            otherNames: this.index.otherNames(this.index.namedAt(station, this.player.clock)),
            colors: [...new Set(lines.map(line => this.baseColor(line)))],
            served: lines.length > 0,
          };
        })
        // A station the track passes but no line calls at is not one to look for.
        .filter(({ served }) => served)
        .map(({ served: _served, ...station }) => station)
        .sort((first, second) => first.name.localeCompare(second.name))
    );
  }

  /**
   * A station's lines, with when each opened there and, if it has, closed: its track, or its calls
   * there while the track stays.
   *
   * @param station - The station id.
   * @returns The station's details.
   */
  public getStationInfo(station: string): StationInfo {
    const info = this.index.stationOf(station);
    const byLine = new Map<string, { opened: number; lastClosed: number; allClosed: boolean }>();
    for (const lineSegment of this.index.lineSegmentsAt(station)) {
      if (!this.timeline.everServes(station, lineSegment.line)) continue;
      const dates = byLine.get(lineSegment.line) ?? { opened: Infinity, lastClosed: 0, allClosed: true };
      dates.opened = Math.min(dates.opened, lineSegment.opens);
      dates.lastClosed = Math.max(dates.lastClosed, lineSegment.closes ?? 0);
      // A line has closed at a station only when every one of its segments there has.
      dates.allClosed &&= lineSegment.closes !== null;
      byLine.set(lineSegment.line, dates);
    }
    const lines = [...byLine.entries()].map(([line, dates]) => {
      // The line stopped calling here, or its track here closed.
      const closed = info.closed?.[line] ?? (dates.allClosed ? toIsoDate(dates.lastClosed) : undefined);
      return {
        id: line,
        name: this.index.lineName(line),
        color: this.baseColor(line),
        // A plan's line has no date: Infinity, from its undated line segments.
        opened: info.infill?.[line] ?? (dates.opened === Infinity ? null : toIsoDate(dates.opened)),
        ...(closed ? { closed } : {}),
      };
    });
    return {
      id: station,
      name: this.index.stationName(station, this.player.clock),
      otherNames: this.index.otherNames(this.index.namedAt(station, this.player.clock)),
      // By opening, a plan's undated lines last.
      lines: lines.sort(
        (first, second) => (first.opened === null ? 1 : 0) - (second.opened === null ? 1 : 0) || (first.opened ?? '').localeCompare(second.opened ?? ''),
      ),
      // Only the names it had dropped by the date shown.
      formerNames: (info.formerNames ?? [])
        .filter(former => toTimestamp(former.until) <= this.player.clock)
        .map(former => ({ name: former.name, otherNames: this.index.otherNames(former), until: former.until })),
      transfers: this.transfersFrom(station),
    };
  }

  /** Stops rendering and removes the map, the minimap and every listener. */
  public destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.minimap?.destroy();
    this.map.remove();
    this.removeAllListeners();
  }

  /**
   * The stations a station changes to on the date shown, with their lines then.
   *
   * @param station - The station id.
   * @returns Each one on the map now.
   */
  private transfersFrom(station: string): TransferInfo[] {
    const cursor = this.player.cursor;
    return this.index.transfersAt(station).flatMap(other => {
      // The lines calling there now, each as it is drawn then (a branch still shown as its parent).
      const calling = this.index
        .lineSegmentsAt(other)
        .filter(lineSegment => this.timeline.isOpen(lineSegment, cursor) && this.timeline.servesStation(other, lineSegment.line, cursor))
        .map(lineSegment => this.timeline.identityOf(lineSegment.line, cursor).id);
      if (calling.length === 0) return [];
      const ordered = [...new Set(calling)].sort(this.index.compareLines);
      return [
        {
          id: other,
          name: this.index.stationName(other, this.player.clock),
          lines: ordered.map(line => ({ id: line, name: this.index.lineName(line), color: this.baseColor(line) })),
        },
      ];
    });
  }

  /**
   * The network year by year, worked out once.
   *
   * @returns Its history up to this year.
   */
  private networkHistory(): NetworkHistory {
    this.history ??= networkHistory(this.index, this.timeline, new Date(this.player.today).getUTCFullYear());
    return this.history;
  }

  /** The overlay's layer groups, bottom to top. */
  private get layers(): MapLayer[] {
    return [this.networkLayer, this.activeStepLayer, this.stationLayer, this.routeLayer, this.reachLayer];
  }

  /** Fades the network behind a route or a reach shown; else brings forward the lines in focus. */
  private applyBackdrop(): void {
    const backdrop = this.route.length > 0 || this.reachStops.length > 0;
    this.networkLayer.focus(backdrop ? [] : this.focusedLines);
    this.stationLayer.fade(backdrop);
  }

  /** Recolours the basemap and installs the overlay once the style has loaded. */
  private installOverlay(): void {
    const font = basemapFont(this.map);
    for (const layer of this.layers) layer.install(font);
    this.applyPalette();
    // A station selected before the style loaded (from a link) gets its ring now, a route its track.
    this.stationLayer.select(this.selectedStation);
    this.routeLayer.update(this.route, this.routeStops);
    this.reachLayer.update(this.reachTrack, this.reachStops);
    this.applyBackdrop();
    this.ready = true;
    this.snapshotStale = true;
    this.instant = true;
    this.updateMinimapViewport();
    this.emit('ready', undefined);
  }

  /** Applies the theme's palette to the basemap and every overlay layer. */
  private applyPalette(): void {
    const palette = PALETTES[this.theme];
    recolorBasemap(this.map, palette, { labels: true });
    for (const layer of this.layers) layer.applyPalette(palette);
  }

  /**
   * Reports the clicked station, or `null` for a click away from any.
   *
   * @param event - The map click.
   */
  private onMapClick(event: MapMouseEvent): void {
    const station = this.stationLayer.stationAt(event.point);
    this.emit('stationClick', station ? this.getStationInfo(station) : null);
  }

  /**
   * A line's own colour in the current theme.
   *
   * @param line - The line id.
   * @returns Its colour.
   */
  private baseColor(line: string): string {
    const info = this.index.lineOf(line);
    return (this.theme === 'dark' && info.darkColor) || info.color;
  }

  /**
   * Builds a step's animation as the network stands at its cursor.
   *
   * @param step - The step.
   * @returns Its animation.
   */
  private createAnimation(step: Step): ReturnType<typeof createStepAnimation> {
    return createStepAnimation(step, { index: this.index, timeline: this.timeline, stationsBefore: this.timeline.stationsOnMap(step.index) });
  }

  /** Redraws at once after the player jumped, nothing pulsing and no caption. */
  private jumped(): void {
    this.stationLayer.resetPulses();
    this.snapshotStale = true;
    this.instant = true;
    this.emit('step', null);
  }

  /**
   * Everything that decides how lines look this frame.
   *
   * @returns The render state.
   */
  private renderState(): RenderState {
    const active = this.player.active;
    const identityPlaying = active?.animation.changesIdentity === true && this.player.phase !== 'pre';
    return {
      index: this.index,
      timeline: this.timeline,
      cursor: this.player.cursor,
      identityProgress: identityPlaying ? this.player.progress : null,
      visibleLines: this.visibleLines,
      baseColor: line => this.baseColor(line),
    };
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
    this.snapshotStale = true;
    this.revealedCount = 0;
    const durationMs = (playback.preSeconds * 1000) / this.player.speed;
    this.camera.focusStep(playback.animation, this.timeline.stationsOnMap(this.player.cursor), station => this.index.coordOf(station), durationMs);
    this.emit('step', playback.animation.describe(this.renderState()));
  }

  /**
   * Clears the caption when the next step is on another date.
   *
   * @param step - The step that ended.
   */
  private onStepEnd(step: Step): void {
    this.snapshotStale = true;
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
    if (this.ready) this.draw(now);
    this.emitTime();
    this.frameRequest = requestAnimationFrame(this.renderFrame);
  };

  /**
   * Draws the frame: the network snapshot when stale, then the playing step and the stations.
   *
   * @param now - The frame time.
   */
  private draw(now: number): void {
    const state = this.renderState();
    const active = this.player.active;
    if (this.snapshotStale || state.identityProgress !== null) this.refreshSnapshot(state);
    const snapshot = this.snapshot!;
    const drawing = emptyDrawing();
    const phase = this.player.phase;
    if (active && phase !== 'pre') {
      active.animation.draw({ state, snapshot, progress: this.player.progress, holdProgress: this.player.holdProgress }, drawing);
    }
    this.activeStepLayer.update(drawing);
    this.updateMinimapActive(drawing);

    const stations = new Map<string, StationLines>([...snapshot.stations].map(([station, lines]) => [station, new Map(lines)]));
    for (const [station, lines] of drawing.reached)
      for (const [lineId, color] of lines) stations.set(station, (stations.get(station) ?? new Map()).set(lineId, color));
    this.stationLayer.update({
      now,
      stations,
      linked: snapshot.linked,
      planned: snapshot.plannedStations,
      highlighted: drawing.highlighted,
      fading: drawing.fading,
      newLabelOpacity: clamp((1 - this.player.holdProgress) / NEW_LABEL_FADE_FRACTION, 0, 1),
      instant: this.instant,
      stepPlaying: active !== null,
    });
    this.instant = false;

    if (drawing.highlighted.size !== this.revealedCount) {
      this.revealedCount = drawing.highlighted.size;
      this.emit('stepProgress', this.revealedCount);
    }
    // The selected station is not on the map on this date (gone, or not yet open): let it go, and say so.
    if (this.selectedStation && !stations.has(this.selectedStation)) {
      this.selectStation(null);
      this.emit('stationClick', null);
    }
  }

  /**
   * Rebuilds the snapshot of the network on the map and sends it to the layers.
   *
   * @param state - The render state.
   */
  private refreshSnapshot(state: RenderState): void {
    this.snapshot = buildNetworkSnapshot(state, this.player.active !== null);
    this.networkLayer.update(this.snapshot);
    this.minimap?.setLines(this.snapshot.lines);
    this.snapshotStale = false;
    this.lastTimeKey = '';
  }

  /**
   * Sends the playing step to the minimap, and clears it once after the step ends.
   *
   * @param drawing - What the step draws now.
   */
  private updateMinimapActive(drawing: StepDrawing): void {
    const hasActive = drawing.lines.features.length > 0;
    if (!this.minimap || (!hasActive && !this.minimapShowsActive)) return;
    this.minimap.setActive(drawing.lines);
    this.minimapShowsActive = hasActive;
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
    const { clock, cursor, playing } = this.player;
    const key = `${Math.floor(clock / DAY_MS)}|${cursor}|${playing}|${this.player.inFuture}`;
    if (key === this.lastTimeKey) return;
    this.lastTimeKey = key;
    const state: TimeState = {
      time: clock,
      cursor,
      stepCount: this.timeline.steps.length,
      todayCursor: this.timeline.cursorAt(this.player.today),
      future: this.player.inFuture,
      playing,
      stats: this.snapshot?.stats ?? { stations: 0, km: 0, lines: 0 },
    };
    this.emit('time', state);
  }
}
