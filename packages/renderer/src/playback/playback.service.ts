import type { Step } from '@railtime/network/engine.types';
import { engineOf } from '@railtime/network/engine.utils';
import type { NetworkFacts } from '@railtime/network/facts.service';
import type { Playhead } from '@railtime/network/facts.types';
import type { StationId } from '@railtime/schema/network.types';
import { END_OVERVIEW_MS, MAX_TILE_WAIT_SECONDS } from './playback.constants';
import type { NetworkParts, PlaybackOptions } from './playback.types';
import { FREE_CAMERA_PRE_SECONDS } from './player.constants';
import { Player } from './player.service';
import type { PlayerEvent } from './player.types';
import { FrameRenderer } from '../layers/frame.service';
import { OverlayController } from '../overlay/controller.service';
import { StepAnimation } from '../steps/animation.service';
import { SELECTED_STATION_ZOOM, SELECT_FLY_MS } from '../transitMap.constants';
import { arrivalPlayhead } from '../transitMap.utils';

/**
 * The history played on the map: each frame, the player's clock moved on (held while the map's tiles
 * load where a change arrives) and the moment drawn and reported; each change framed and captioned as
 * it starts; a jump drawn at once; the whole network in view at the end; another network taken up where
 * its `arrival` says, or the view changed, with the change playing carried across. The selected station's ring shows only
 * while the moment has the station. `TransitMap` runs it from its frame loop, commands and effects.
 */
export class Playback {
  /** The map's parts and what it reports to. */
  private readonly options: PlaybackOptions;
  /** The network drawn now, with its player and frames: made again for another. */
  private parts: NetworkParts;
  /** A route, a reach or coverage over the network, whichever network it is. */
  private readonly overlay: OverlayController;
  /** The selected station is off the map at the moment shown: its ring hidden until it is back. */
  private selectionAway = false;
  /** Real seconds the playing change has waited, at the end of its camera move, for the map's tiles. */
  private tileWait = 0;

  public constructor(options: PlaybackOptions) {
    const { props, layers, camera, notify } = options;
    this.options = options;
    this.parts = this.partsFor(props().facts);
    this.overlay = new OverlayController({
      route: layers.route,
      reach: layers.reach,
      coverage: layers.coverage,
      camera,
      facts: () => this.parts.facts,
      moment: () => this.parts.player.playhead,
      theme: () => props().theme,
      report: result => notify('overlay', result),
    });
    this.jumped();
  }

  /** The network drawn now. */
  public get facts(): NetworkFacts {
    return this.parts.facts;
  }

  /** The clock and the step playing. */
  public get player(): Player {
    return this.parts.player;
  }

  /**
   * One frame: the clock moved on, then, once the map is ready, the moment drawn and reported.
   *
   * @param now - The frame time.
   * @param seconds - The time since the last frame.
   * @param ready - Whether the map's layers are installed.
   */
  public frame(now: number, seconds: number, ready: boolean): void {
    const { player } = this.parts;
    this.handle(player.tick(ready && this.waitsForTiles(seconds) ? 0 : seconds));
    if (ready) this.draw(now, seconds);
  }

  /**
   * Moves to a playhead: playing, it plays on from there; paused, it stays paused.
   *
   * @param to - Where to.
   */
  public seek(to: Playhead): void {
    this.partsNow().player.seek(to);
    this.jumped();
  }

  /**
   * Plays: on from here, or from a playhead.
   *
   * @param from - Where from: here, unless given.
   */
  public play(from?: Playhead): void {
    this.partsNow().player.play(from);
    if (from) this.jumped();
  }

  /** Pauses where it is. */
  public pause(): void {
    this.parts.player.pause();
  }

  /** Finishes the change playing now, or goes to the next one. */
  public skip(): void {
    this.handle(this.partsNow().player.skip());
  }

  /**
   * A year back or on.
   *
   * @param direction - Back (-1) or on (1).
   */
  public stepYear(direction: -1 | 1): void {
    this.partsNow().player.stepYear(direction);
    this.jumped();
  }

  /** To just before the change before the one playing, or the last played: playing, it plays again. */
  public previousChange(): void {
    this.partsNow().player.previousChange();
    this.jumped();
  }

  /**
   * Fits the whole network in view.
   *
   * @param durationMs - How long the move takes.
   */
  public fitNetwork(durationMs: number): void {
    this.options.camera.fit(engineOf(this.parts.facts).index.bounds, Infinity, durationMs);
  }

  /** The `facts` prop changed: draws the network it gives on the same map, where `arrival` says, the camera where it is, its overlay worked out on it. */
  public showNetwork(): void {
    if (this.parts.facts === this.options.props().facts) return;
    this.partsNow();
    this.drawOverlay();
    this.jumped();
  }

  /**
   * The `viewMode` prop changed. Into 3D the buildings rise and the camera comes down to them; back, it
   * lies flat and faces north. The change playing goes on as now seen, from as far as it had got: in 3D
   * the camera rides along it from where it has grown to, or, still on its way there, flies to where it
   * starts. (Back flat, it only lies flat: framing it then would cut the tilt short.)
   */
  public showView(): void {
    const { player, frames } = this.parts;
    const { viewMode } = this.options.props();
    this.options.layers.showBuildings(viewMode === '3d');
    player.rebuild();
    this.options.camera.tilt(frames.growing());
    if (viewMode === '3d' && player.phase === 'pre') this.focusActive();
  }

  /**
   * Draws the network again next frame.
   *
   * @param instant - Show the stations at once, with no pop-in.
   */
  public redraw(instant = false): void {
    this.parts.frames.redraw(instant);
  }

  /** Draws the overlay the props ask for, and the network behind it. */
  public drawOverlay(): void {
    const { overlay, boundary } = this.options.props();
    this.overlay.draw(overlay, boundary);
    this.applyBackdrop();
  }

  /** Fades the network behind a route or a reach; else brings forward the lines in focus, read as the frame draws them, so what is focused is what is drawn. */
  public applyBackdrop(): void {
    const { focusedLines } = this.options.props();
    this.options.layers.applyBackdrop(this.overlay.backdrop, focusedLines && this.parts.frames.asDrawn(focusedLines));
  }

  /**
   * Rings a station selected and flies to it, or takes the ring off: shown at once, until the moment
   * takes the station off the map.
   *
   * @param station - The station, or `null`.
   */
  public select(station: StationId | null): void {
    this.selectionAway = false;
    this.options.layers.stations.select(station);
    if (station) this.options.camera.flyTo(engineOf(this.parts.facts).index.coordOf(station), SELECTED_STATION_ZOOM, SELECT_FLY_MS);
  }

  /**
   * The parts of the network the props name, made if they are another's: a command acts on the props
   * the map has, and before it is ready, `facts`' effect waits while a command does not.
   *
   * @returns The parts.
   */
  private partsNow(): NetworkParts {
    const { facts } = this.options.props();
    if (facts !== this.parts.facts) {
      this.parts = this.partsFor(facts);
      this.options.minimap?.frame(engineOf(facts).index.bounds);
    }
    return this.parts;
  }

  /**
   * What a network is drawn with: its player, where `arrival` says, and its frames, on the map's own layers.
   *
   * @param facts - The network.
   * @returns Its parts.
   */
  private partsFor(facts: NetworkFacts): NetworkParts {
    const { props, layers, minimap } = this.options;
    const engine = engineOf(facts);
    const { index, timeline, playheads } = engine;
    const player = new Player(engine, step => new StepAnimation(step, { index, timeline, view: props().viewMode }), props);
    player.seek(arrivalPlayhead(playheads, props().arrival));
    const frames = new FrameRenderer({
      facts,
      index,
      timeline,
      player,
      network: layers.network,
      activeStep: layers.activeStep,
      trains: layers.trains,
      stations: layers.stations,
      trainService: cursor => engine.trainService(cursor),
      showTrains: () => props().trains,
      minimap,
      baseColor: line => facts.colorOf(line)[props().theme],
    });
    return { facts, player, frames };
  }

  /**
   * Reacts to what the player did.
   *
   * @param events - The player's events.
   */
  private handle(events: PlayerEvent[]): void {
    for (const event of events) {
      if (event.type === 'stepStart') this.onStepStart();
      else if (event.type === 'stepEnd') this.onStepEnd(event.step);
      else this.onPlaybackEnd();
    }
  }

  /** Redraws at once after a jump in time, nothing pulsing; the caption is the change left drawn in part, if any. */
  private jumped(): void {
    const { player, frames, facts } = this.parts;
    const active = player.active;
    this.tileWait = 0;
    this.options.layers.stations.resetPulses();
    if (active) frames.stepStarted();
    frames.redraw(true);
    this.options.notify('step', active ? facts.change(active.animation.step.index) : null);
  }

  /** Frames the change playing, as the view and camera are set, and waits for the camera before it draws. */
  private focusActive(): void {
    const { player, facts } = this.parts;
    const active = player.active;
    if (!active) return;
    const { index, timeline } = engineOf(facts);
    const moveMs = this.options.camera.focusStep(
      active.animation,
      timeline.stationsOnMap(player.cursor),
      station => index.coordOf(station),
      (active.preSeconds * 1000) / player.speed,
    );
    // At once, after a beat, where it stays.
    player.retimeLeadIn(moveMs === 0 ? FREE_CAMERA_PRE_SECONDS : (moveMs / 1000) * player.speed);
  }

  /** Frames a starting change and announces it: it starts drawing as the camera arrives. */
  private onStepStart(): void {
    const { player, frames, facts } = this.parts;
    const active = player.active;
    if (!active) return;
    frames.stepStarted();
    this.tileWait = 0;
    this.focusActive();
    this.options.notify('step', facts.change(active.animation.step.index));
  }

  /**
   * Clears the caption when the next step is on another date.
   *
   * @param step - The step that ended.
   */
  private onStepEnd(step: Step): void {
    const { frames, facts } = this.parts;
    frames.redraw();
    const next = engineOf(facts).timeline.steps[step.index + 1];
    if (next?.time !== step.time) this.options.notify('step', null);
  }

  /** Playback reached its end: the whole network in view. */
  private onPlaybackEnd(): void {
    this.options.notify('step', null);
    this.options.notify('end', undefined);
    this.fitNetwork(END_OVERVIEW_MS);
  }

  /**
   * Whether the playing change waits this frame for the map's tiles: as its camera move ends, where the
   * camera arrived is not drawn yet (a jump across the city, at street level, on a sharp screen), and
   * it has not waited `MAX_TILE_WAIT_SECONDS` already. The line then starts growing over streets, not
   * a blank that fills in as it goes.
   *
   * @param seconds - The time since the last frame.
   * @returns Whether to hold the change this frame.
   */
  private waitsForTiles(seconds: number): boolean {
    const { player } = this.parts;
    const active = player.active;
    if (!active || !player.playing) return false;
    const arriving = active.elapsed < active.preSeconds && active.elapsed + seconds * player.speed >= active.preSeconds;
    if (!arriving || this.tileWait >= MAX_TILE_WAIT_SECONDS || this.options.tilesLoaded()) return false;
    this.tileWait += seconds;
    return true;
  }

  /**
   * Draws the frame; hides the ring of a selected station the moment took off the map, and says so;
   * follows the date with the overlay; and reports the time.
   *
   * @param now - The frame time.
   * @param seconds - The time since the last frame.
   */
  private draw(now: number, seconds: number): void {
    const { frames } = this.parts;
    const { selectedStation, overlay: shown, boundary } = this.options.props();
    const { revealed, selectionGone, chase, refreshed } = frames.draw(now, selectedStation);
    // Another moment may draw a line in focus as another.
    if (refreshed) this.applyBackdrop();
    this.options.camera.follow(chase, seconds);
    if (revealed !== null) this.options.notify('stepProgress', revealed);
    if (selectedStation && selectionGone !== this.selectionAway) {
      this.selectionAway = selectionGone;
      this.options.layers.stations.select(selectionGone ? null : selectedStation);
      if (selectionGone) this.options.notify('selectionGone', selectedStation);
    }
    // The overlay first, so the app hears of the new date with what the overlay came to on it.
    this.overlay.follow(shown, boundary);
    const time = frames.timeState();
    if (time) this.options.notify('time', time);
  }
}
