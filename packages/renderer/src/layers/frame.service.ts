import { clamp } from '../core/easing.utils';
import { DAY_MS } from '../core/date.utils';
import type { StepDrawing } from '../steps/animation.types';
import { emptyDrawing } from '../steps/animation.utils';
import { NEW_LABEL_FADE_FRACTION } from '../transitMap.constants';
import type { TimeState } from '../transitMap.types';
import type { StationLines } from './features.types';
import type { FrameOutcome, FrameParts } from './frame.types';
import type { RenderState } from './lineStyle.types';
import type { NetworkSnapshot } from './snapshot.types';
import { buildNetworkSnapshot } from './snapshot.utils';

/**
 * Draws each frame on the layers: the network snapshot when it is stale, then the playing step and
 * the stations. A frame with nothing playing, nothing popping in and the same snapshot sends the map
 * nothing, so MapLibre is left to pan and zoom. Knows no map, only the layers.
 */
export class FrameRenderer {
  /** Lines the user has toggled on. */
  public visibleLines: Set<string>;
  /** The network, its history, the player and the layers. */
  private readonly parts: FrameParts;
  /** Everything already on the map at the cursor. */
  private snapshot: NetworkSnapshot | null = null;
  /** The snapshot needs rebuilding: the cursor, toggles or theme changed. */
  private stale = true;
  /** The next frame shows stations without their pop-in. */
  private instant = true;
  /** How many of the playing step's new stations have appeared. */
  private revealedCount = 0;
  /** The minimap was last sent a non-empty active drawing. */
  private minimapShowsActive = false;
  /** Clock day, cursor and playing state at the last time state, to give one only on change. */
  private lastTimeKey = '';

  public constructor(parts: FrameParts) {
    this.parts = parts;
    this.visibleLines = new Set(parts.index.lineIds);
  }

  /**
   * Rebuilds the snapshot next frame: the cursor, the toggles or the theme changed.
   *
   * @param instant - Show the stations at once, with no pop-in: after a jump in time, or a new style.
   */
  public redraw(instant = false): void {
    this.stale = true;
    this.instant ||= instant;
  }

  /** A step started: rebuild, and count its stations from none. */
  public stepStarted(): void {
    this.stale = true;
    this.revealedCount = 0;
  }

  /**
   * Everything that decides how lines look this frame.
   *
   * @returns The render state.
   */
  public renderState(): RenderState {
    const { index, timeline, player, baseColor } = this.parts;
    const active = player.active;
    const identityPlaying = active?.animation.changesIdentity === true && player.phase !== 'pre';
    return { index, timeline, cursor: player.cursor, identityProgress: identityPlaying ? player.progress : null, visibleLines: this.visibleLines, baseColor };
  }

  /**
   * Draws a frame.
   *
   * @param now - The frame time.
   * @param selected - The station ringed on the map, if any.
   * @returns What the app is told.
   */
  public draw(now: number, selected: string | null): FrameOutcome {
    const { player, activeStep, stations: stationLayer } = this.parts;
    const state = this.renderState();
    const active = player.active;
    const refreshed = this.stale || state.identityProgress !== null;
    if (refreshed) this.refreshSnapshot(state);
    const snapshot = this.snapshot!;
    const drawing = emptyDrawing();
    const drawingStep = active !== null && player.phase !== 'pre';
    if (drawingStep) active.animation.draw({ state, snapshot, progress: player.progress, holdProgress: player.holdProgress }, drawing);
    activeStep.update(drawing);
    this.updateMinimapActive(drawing);

    if (refreshed || drawingStep || this.instant || stationLayer.animating) {
      const stations = new Map<string, StationLines>([...snapshot.stations].map(([station, lines]) => [station, new Map(lines)]));
      for (const [station, lines] of drawing.reached)
        for (const [lineId, color] of lines) stations.set(station, (stations.get(station) ?? new Map()).set(lineId, color));
      stationLayer.update({
        now,
        stations,
        linked: snapshot.linked,
        planned: snapshot.plannedStations,
        highlighted: drawing.highlighted,
        fading: drawing.fading,
        newLabelOpacity: clamp((1 - player.holdProgress) / NEW_LABEL_FADE_FRACTION, 0, 1),
        instant: this.instant,
        stepPlaying: active !== null,
      });
      this.instant = false;
    }

    const revealed = drawing.highlighted.size === this.revealedCount ? null : drawing.highlighted.size;
    if (revealed !== null) this.revealedCount = revealed;
    return { revealed, selectionGone: selected !== null && !snapshot.stations.has(selected) && !drawing.reached.has(selected) };
  }

  /**
   * The clock, the cursor and the network's size, when the day, the cursor, the playing state or the
   * snapshot changed since last asked.
   *
   * @returns The time state, or `null` when nothing changed.
   */
  public timeState(): TimeState | null {
    const { player, timeline } = this.parts;
    const { clock, cursor, playing } = player;
    const key = `${Math.floor(clock / DAY_MS)}|${cursor}|${playing}|${player.inFuture}`;
    if (key === this.lastTimeKey) return null;
    this.lastTimeKey = key;
    return {
      time: clock,
      cursor,
      stepCount: timeline.steps.length,
      todayCursor: timeline.cursorAt(player.today),
      future: player.inFuture,
      playing,
      stats: this.snapshot?.stats ?? { stations: 0, km: 0, lines: 0 },
    };
  }

  /**
   * Rebuilds the snapshot of the network on the map and sends it to the layers.
   *
   * @param state - The render state.
   */
  private refreshSnapshot(state: RenderState): void {
    this.snapshot = buildNetworkSnapshot(state, this.parts.player.active !== null);
    this.parts.network.update(this.snapshot);
    this.parts.minimap?.setLines(this.snapshot.lines);
    this.stale = false;
    this.lastTimeKey = '';
  }

  /**
   * Sends the playing step to the minimap, and clears it once after the step ends.
   *
   * @param drawing - What the step draws now.
   */
  private updateMinimapActive(drawing: StepDrawing): void {
    const hasActive = drawing.lines.features.length > 0;
    if (!this.parts.minimap || (!hasActive && !this.minimapShowsActive)) return;
    this.parts.minimap.setActive(drawing.lines);
    this.minimapShowsActive = hasActive;
  }
}
