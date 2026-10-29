import { type LngLatBoundsLike, Map as MapLibreMap, type MapMouseEvent, setWorkerUrl } from 'maplibre-gl';
import { EventEmitter } from './core/eventEmitter.service';
import { required } from './core/required.utils';
import { ActiveStepLayer } from './layers/activeStepLayer.service';
import { basemapFont, recolorBasemap } from './layers/basemap.utils';
import type { StationLines } from './layers/features.types';
import type { RenderState } from './layers/lineStyle.types';
import { LAYERS } from './layers/layers.constants';
import type { MapLayer } from './layers/mapLayer.service';
import { NetworkLayer } from './layers/networkLayer.service';
import type { NetworkSnapshot } from './layers/networkSnapshot.types';
import { buildNetworkSnapshot } from './layers/networkSnapshot.utils';
import { StationLayer } from './layers/stationLayer.service';
import { DEFAULT_BASEMAP, PALETTES } from './layers/theme.constants';
import { Minimap } from './minimap/minimap.service';
import { DAY_MS, toIsoDate, todayTimestamp } from './model/date.utils';
import { NetworkIndex } from './model/networkIndex.service';
import { Timeline } from './model/timeline.service';
import type { Step } from './model/timeline.types';
import { CameraDirector } from './playback/camera.service';
import { clamp } from './playback/easing.utils';
import { CAMERA_PRE_SECONDS, FREE_CAMERA_PRE_SECONDS } from './playback/player.constants';
import { Player } from './playback/player.service';
import type { ActivePlayback, PlayerEvent } from './playback/player.types';
import type { StepDrawing } from './steps/stepAnimation.types';
import { createStepAnimation, emptyDrawing } from './steps/stepAnimation.utils';
import {
  DEFAULT_PADDING,
  END_OVERVIEW_MS,
  FIT_NETWORK_MS,
  MAX_FRAME_SECONDS,
  NEW_LABEL_FADE_FRACTION,
  OPENING_MAX_ZOOM,
  OPENING_SIDE_PADDING,
  SELECTED_STATION_ZOOM,
  SELECT_FLY_MS,
} from './transitMap.constants';
import type { CameraMode, LineInfo, MapView, Padding, StationInfo, Theme, TimeState, TransitMapEvents, TransitMapOptions } from './transitMap.types';

/**
 * An interactive transit map with a history player: the renderer's one public entry.
 *
 * Give it a normalized `Network`. It draws the network on a MapLibre basemap as of any date
 * (`setDate`), or plays its history step by step (`play`). It owns the map and nothing else: the app
 * around it owns every control and caption, calling methods here and listening to events.
 */
export class TransitMap extends EventEmitter<TransitMapEvents> {
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
    this.index = new NetworkIndex(options.network);
    this.timeline = new Timeline(this.index);
    this.player = new Player(this.timeline, todayTimestamp(), step => this.createAnimation(step));
    this.theme = options.theme ?? 'dark';
    this.visibleLines = new Set(this.index.lineIds);

    const basemap = options.basemap ?? DEFAULT_BASEMAP;
    const padding = options.padding ?? DEFAULT_PADDING;
    const opening = options.view
      ? { center: options.view.center, zoom: options.view.zoom }
      : {
          bounds: this.index.bounds as LngLatBoundsLike,
          // Clear of the title and playback bar; the sides stay narrow, as their panels are small until playback.
          fitBoundsOptions: {
            padding: { top: padding.top, bottom: padding.bottom, left: OPENING_SIDE_PADDING, right: OPENING_SIDE_PADDING },
            maxZoom: OPENING_MAX_ZOOM,
          },
        };
    this.map = new MapLibreMap({
      container: options.container,
      style: basemap,
      ...opening,
      attributionControl: { compact: true, customAttribution: options.network.meta.attribution },
    });
    this.camera = new CameraDirector(this.map, padding);
    this.networkLayer = new NetworkLayer(this.map);
    this.activeStepLayer = new ActiveStepLayer(this.map);
    this.stationLayer = new StationLayer(
      this.map,
      station => this.index.coordOf(station),
      station => this.index.stationName(station, this.player.clock),
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

  /** The first and last dates the timeline covers, as timestamps. */
  public get range(): { start: number; end: number } {
    return { start: this.timeline.start, end: this.player.end };
  }

  /**
   * Shows the network as it was at the end of a day. Stops playback.
   *
   * @param time - A timestamp on that day.
   */
  public setDate(time: number): void {
    this.player.playing = false;
    this.player.seek(time);
    this.stationLayer.resetPulses();
    this.snapshotStale = true;
    this.instant = true;
    this.emit('step', null);
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
      };
    });
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
        opened: info.infill?.[line] ?? toIsoDate(dates.opened),
        ...(closed ? { closed } : {}),
      };
    });
    return {
      id: station,
      name: this.index.stationName(station, this.player.clock),
      lines: lines.sort((first, second) => first.opened.localeCompare(second.opened)),
      formerNames: info.formerNames ?? [],
    };
  }

  /** Stops rendering and removes the map, the minimap and every listener. */
  public destroy(): void {
    cancelAnimationFrame(this.frameRequest);
    this.minimap?.destroy();
    this.map.remove();
    this.removeAllListeners();
  }

  /** The overlay's layer groups, bottom to top. */
  private get layers(): MapLayer[] {
    return [this.networkLayer, this.activeStepLayer, this.stationLayer];
  }

  /** Recolours the basemap and installs the overlay once the style has loaded. */
  private installOverlay(): void {
    const font = basemapFont(this.map);
    for (const layer of this.layers) layer.install(font);
    this.applyPalette();
    // A station selected before the style loaded (from a link) gets its ring now.
    this.stationLayer.select(this.selectedStation);
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
    if (this.selectedStation && !stations.has(this.selectedStation)) this.selectStation(null);
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
    const key = `${Math.floor(clock / DAY_MS)}|${cursor}|${playing}`;
    if (key === this.lastTimeKey) return;
    this.lastTimeKey = key;
    const state: TimeState = {
      time: clock,
      cursor,
      stepCount: this.timeline.steps.length,
      playing,
      stats: this.snapshot?.stats ?? { stations: 0, km: 0, lines: 0 },
    };
    this.emit('time', state);
  }
}
