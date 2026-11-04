import type { Step } from '@railtime/network/engine.types';
import type { StationId } from '@railtime/schema/network.types';
import type { NetworkParts } from '../transitMap.types';
import { END_OVERVIEW_MS, MAX_TILE_WAIT_SECONDS } from './playback.constants';
import type { PlaybackOptions } from './playback.types';
import { FREE_CAMERA_PRE_SECONDS } from './player.constants';
import type { PlayerEvent } from './player.types';

/**
 * The history played on the map: each frame, the player's clock moved on (held while the map's tiles
 * load where a change arrives) and the moment drawn and reported; each change framed and captioned as
 * it starts; a jump drawn at once; the whole network in view at the end. The selected station's ring
 * shows only while the moment has the station. `TransitMap` runs it from its frame loop and commands.
 */
export class Playback {
  /** The map's parts and what it reports to. */
  private readonly options: PlaybackOptions;
  /** The selected station is off the map at the moment shown: its ring hidden until it is back. */
  private selectionAway = false;
  /** Real seconds the playing change has waited, at the end of its camera move, for the map's tiles. */
  private tileWait = 0;

  public constructor(options: PlaybackOptions) {
    this.options = options;
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
   * Reacts to what the player did.
   *
   * @param events - The player's events.
   */
  public handle(events: PlayerEvent[]): void {
    for (const event of events) {
      if (event.type === 'stepStart') this.onStepStart();
      else if (event.type === 'stepEnd') this.onStepEnd(event.step);
      else this.onPlaybackEnd();
    }
  }

  /** Redraws at once after a jump in time, nothing pulsing; the caption is the change left drawn in part, if any. */
  public jumped(): void {
    const { player, frames, facts } = this.parts;
    const active = player.active;
    this.tileWait = 0;
    this.options.stations.resetPulses();
    if (active) frames.stepStarted();
    frames.redraw(true);
    this.options.notify('step', active ? facts.change(active.animation.step.index) : null);
  }

  /**
   * Rings a station selected, or none: shown at once, until the moment takes it off the map.
   *
   * @param station - The station, or `null`.
   */
  public select(station: StationId | null): void {
    this.selectionAway = false;
    this.options.stations.select(station);
  }

  /** Frames the change playing, as the view and camera are set, and waits for the camera before it draws. */
  public focusActive(): void {
    const { player, facts } = this.parts;
    const active = player.active;
    if (!active) return;
    const { index, timeline } = facts.engine;
    const moveMs = this.options.camera.focusStep(
      active.animation,
      timeline.stationsOnMap(player.cursor),
      station => index.coordOf(station),
      (active.preSeconds * 1000) / player.speed,
    );
    // At once, after a beat, where it stays.
    player.retimeLeadIn(moveMs === 0 ? FREE_CAMERA_PRE_SECONDS : (moveMs / 1000) * player.speed);
  }

  /** The network drawn now, with its player, overlay and frames. */
  private get parts(): NetworkParts {
    return this.options.parts();
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
    const next = facts.engine.timeline.steps[step.index + 1];
    if (next?.time !== step.time) this.options.notify('step', null);
  }

  /** Playback reached its end: the whole network in view. */
  private onPlaybackEnd(): void {
    this.options.notify('step', null);
    this.options.notify('end', undefined);
    this.options.fitNetwork(END_OVERVIEW_MS);
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
    const { frames, overlay } = this.parts;
    const { selectedStation, overlay: shown, boundary } = this.options.props();
    const { revealed, selectionGone, chase } = frames.draw(now, selectedStation);
    this.options.camera.follow(chase, seconds);
    if (revealed !== null) this.options.notify('stepProgress', revealed);
    if (selectedStation && selectionGone !== this.selectionAway) {
      this.selectionAway = selectionGone;
      this.options.stations.select(selectionGone ? null : selectedStation);
      if (selectionGone) this.options.notify('selectionGone', selectedStation);
    }
    // The overlay first, so the app hears of the new date with what the overlay came to on it.
    overlay.follow(shown, boundary);
    const time = frames.timeState();
    if (time) this.options.notify('time', time);
  }
}
