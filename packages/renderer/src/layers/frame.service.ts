import { DAY_MS } from '@railtime/core/date.utils';
import { clamp } from '@railtime/core/number.utils';
import { required } from '@railtime/core/required.utils';
import type { TrainService } from '@railtime/network/trains.service';
import type { LineId, StationId } from '@railtime/schema/network.types';
import { UNTOUCHED_BASE } from '../steps/animation.constants';
import type { BaseNetwork, ChaseTarget, StepDrawing } from '../steps/animation.types';
import { emptyDrawing, sameBase } from '../steps/animation.utils';
import { NEW_LABEL_FADE_FRACTION } from '../transitMap.constants';
import type { TimeState } from '../transitMap.types';
import { timeStateOf } from '../transitMap.utils';
import type { FrameOutcome, FrameParts } from './frame.types';
import type { NetworkSnapshot, StationLines } from './snapshot.types';
import { buildNetworkSnapshot } from './snapshot.utils';
import type { RenderState } from './style.types';
import { linesAsDrawn } from './style.utils';
import { TRAIN_TIME_LAPSE } from './trains.constants';
import { trainsAt } from './trains.utils';

/**
 * Draws each frame on the layers: the network snapshot when it is stale or the step playing asks
 * something else of it, then the playing step and the stations. A frame on which none of them moved
 * sends the map nothing, so MapLibre is left to pan and zoom. Knows no map, only the layers; what
 * outlasts a network (what the layers and the minimap hold) stays with them.
 */
export class FrameRenderer {
  /** The network, its history, the player and the layers. */
  private readonly parts: FrameParts;
  /** Everything already on the map at the cursor. */
  private snapshot: NetworkSnapshot | null = null;
  /** The snapshot needs rebuilding: the cursor or theme changed. */
  private stale = true;
  /** What the step playing asked of the network when the snapshot was built. */
  private base: BaseNetwork = UNTOUCHED_BASE;
  /** The step playing, as last drawn: drawn again only once it moves. */
  private drawing = emptyDrawing();
  /** Where the step playing stood when last drawn: its phase and how far through it. */
  private stepDrawnAt = '';
  /** The next frame shows stations without their pop-in. */
  private instant = true;
  /** How many of the playing step's new stations have appeared. */
  private revealedCount = 0;
  /** The trains the network runs at the cursor, until it moves; `null` to ask again. */
  private service: TrainService | null = null;
  /** Clock day, cursor, progress to a hundredth and playing state at the last time state, to give one only on change. */
  private lastTimeKey = '';

  public constructor(parts: FrameParts) {
    this.parts = parts;
  }

  /**
   * Rebuilds the snapshot next frame: the cursor or the theme changed.
   *
   * @param instant - Show the stations at once, with no pop-in: after a jump in time, or a new style.
   */
  public redraw(instant = false): void {
    this.stale = true;
    this.instant ||= instant;
  }

  /** A step started: count its stations from none. */
  public stepStarted(): void {
    this.revealedCount = 0;
  }

  /**
   * Everything that decides how lines look this frame.
   *
   * @returns The render state.
   */
  public renderState(): RenderState {
    const { index, timeline, player, baseColor } = this.parts;
    return { index, timeline, cursor: player.cursor, base: player.base, baseColor };
  }

  /**
   * Lines as this frame draws them, by the rule the network's features were drawn by.
   *
   * @param lines - The line ids.
   * @returns The ids drawn.
   */
  public asDrawn(lines: readonly LineId[]): LineId[] {
    return linesAsDrawn(this.renderState(), lines);
  }

  /**
   * Draws a frame.
   *
   * @param now - The frame time.
   * @param selected - The station ringed on the map, if any.
   * @returns What the app is told.
   */
  public draw(now: number, selected: StationId | null): FrameOutcome {
    const { player, stations: stationLayer, minimap } = this.parts;
    const state = this.renderState();
    const refreshed = this.stale || !sameBase(state.base, this.base);
    if (refreshed) this.refreshSnapshot(state);
    const snapshot = required(this.snapshot ?? undefined, 'the snapshot the first frame builds');
    const stepMoved = this.drawStep(state, snapshot, refreshed);
    const { drawing } = this;
    this.drawTrains(now, state, snapshot);
    minimap?.flush(now);

    if (refreshed || stepMoved || this.instant || stationLayer.animating) {
      const stations = new Map<StationId, StationLines>([...snapshot.stations].map(([station, lines]) => [station, new Map(lines)]));
      for (const [station, lines] of drawing.reached)
        for (const [lineId, color] of lines) stations.set(station, (stations.get(station) ?? new Map<LineId, string>()).set(lineId, color));
      stationLayer.update({
        now,
        stations,
        linked: drawing.linked.size > 0 ? new Set([...snapshot.linked, ...drawing.linked]) : snapshot.linked,
        planned: snapshot.plannedStations,
        highlighted: drawing.highlighted,
        fading: drawing.fading,
        renamed: drawing.renamed,
        spells: drawing.spells,
        newLabelOpacity: clamp((1 - player.holdProgress) / NEW_LABEL_FADE_FRACTION, 0, 1),
        instant: this.instant,
        stepPlaying: player.active !== null,
      });
      this.instant = false;
    }

    const revealed = drawing.highlighted.size === this.revealedCount ? null : drawing.highlighted.size;
    if (revealed !== null) this.revealedCount = revealed;
    return {
      revealed,
      selectionGone: selected !== null && !snapshot.stations.has(selected) && !drawing.reached.has(selected),
      chase: drawing.chase,
      refreshed,
    };
  }

  /**
   * Where the change playing has grown to, and which way it goes on, for the camera to ride along it
   * from there: as this frame draws it.
   *
   * @returns The target; `null` when nothing grows.
   */
  public growing(): ChaseTarget | null {
    return this.snapshot ? this.drawActive(this.renderState(), this.snapshot).chase : null;
  }

  /**
   * The playhead and the network's size, when the day, the cursor, the change's progress (to a
   * hundredth) or the playing state changed since last asked.
   *
   * @returns The time state, or `null` when nothing changed.
   */
  public timeState(): TimeState | null {
    const { player, facts } = this.parts;
    const { playhead, playing } = player;
    const key = `${Math.floor(playhead.time / DAY_MS)}|${playhead.cursor}|${facts.playheads.hundredths(playhead.progress)}|${playing}|${player.inPlan}`;
    if (key === this.lastTimeKey) return null;
    this.lastTimeKey = key;
    return timeStateOf(facts, playhead, { inPlan: player.inPlan, playing });
  }

  /**
   * Draws the step playing again on the map and the minimap, if it moved since last drawn or the
   * network under it did: paused, it stands as it is and costs nothing.
   *
   * @param state - The render state.
   * @param snapshot - The network on the map.
   * @param refreshed - The network under it was built again this frame.
   * @returns Whether it was drawn.
   */
  private drawStep(state: RenderState, snapshot: NetworkSnapshot, refreshed: boolean): boolean {
    const { player, activeStep, minimap } = this.parts;
    const drawnAt = `${player.phase}|${player.progress}|${player.holdProgress}`;
    if (!refreshed && drawnAt === this.stepDrawnAt) return false;
    this.stepDrawnAt = drawnAt;
    this.drawing = this.drawActive(state, snapshot);
    activeStep.update(this.drawing);
    minimap?.setActive({ type: 'FeatureCollection', features: [...this.drawing.lines.features, ...this.drawing.growing.features] });
    return true;
  }

  /**
   * What the change playing draws this frame: nothing while the camera gets there.
   *
   * @param state - The render state.
   * @param snapshot - The network on the map.
   * @returns The drawing.
   */
  private drawActive(state: RenderState, snapshot: NetworkSnapshot): StepDrawing {
    const { player } = this.parts;
    const drawing = emptyDrawing();
    if (player.active && player.phase !== 'pre')
      player.active.animation.draw({ state, snapshot, progress: player.progress, holdProgress: player.holdProgress }, drawing);
    return drawing;
  }

  /**
   * Rebuilds the snapshot of the network on the map and sends it to the layers.
   *
   * @param state - The render state.
   */
  private refreshSnapshot(state: RenderState): void {
    this.snapshot = buildNetworkSnapshot(state);
    this.base = state.base;
    this.parts.network.update(this.snapshot);
    this.parts.minimap?.setNetwork(this.snapshot);
    this.service = null;
    this.stale = false;
  }

  /**
   * Moves the trains to where they are this frame, on their own clock, or takes them off once they are turned off.
   *
   * @param now - The frame time.
   * @param state - The render state.
   * @param snapshot - The network on the map.
   */
  private drawTrains(now: number, state: RenderState, snapshot: NetworkSnapshot): void {
    const { motion, trainService, showTrains } = this.parts;
    if (!showTrains()) {
      motion.show('trains', []);
      return;
    }
    this.service ??= trainService(state.cursor);
    motion.show('trains', trainsAt(this.service.placesAt((now / 1000) * TRAIN_TIME_LAPSE), state, snapshot.sideBySide));
  }
}
