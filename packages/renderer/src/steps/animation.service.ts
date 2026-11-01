import type { LngLat } from '@railtime/core/geometry.types';
import type { CloseStep, Growth, IdentityStep, InfillStep, OpenStep, RenameStep, SegmentPlan, StationCloseStep, Step } from '@railtime/network/engine.types';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';
import { pushTo } from '@railtime/core/collection.utils';
import { lineFeature, pointFeature } from '../layers/snapshot.utils';
import { offsetFor, resolveLine } from '../layers/style.utils';
import { sliceAlong } from '@railtime/core/geometry.utils';
import { easeInOut } from '../support/drawing.utils';
import { chaseAlong, frontKmAt, growthSeconds, mainPathOf } from './growth.utils';
import {
  CLOSE_DRAW_SECONDS,
  CLOSE_HOLD_SECONDS,
  GROWTH_PACE,
  IDENTITY_DRAW_SECONDS,
  IDENTITY_HOLD_SECONDS,
  INFILL_DRAW_SECONDS,
  INFILL_HOLD_SECONDS,
  MIN_DRAW_SECONDS,
  OPEN_HOLD_SECONDS,
  RENAME_DRAW_SECONDS,
  RENAME_HOLD_SECONDS,
  STATION_CLOSE_DRAW_SECONDS,
  STATION_CLOSE_HOLD_SECONDS,
} from './animation.constants';

/**
 * How one kind of step plays: how long it takes, what the camera frames, and
 * what it draws each frame. One subclass per kind of step; the player and the map only ever talk
 * to this base class.
 */
export abstract class StepAnimation<Kind extends Step = Step> {
  /** The step being played. */
  public readonly step: Kind;
  /** Seconds at 1× for the change to animate. */
  public abstract readonly drawSeconds: number;
  /** Seconds at 1× the result stays highlighted afterwards. */
  public abstract readonly holdSeconds: number;
  /** The network as it stood when the step started. */
  protected readonly context: StepContext;

  protected constructor(step: Kind, context: StepContext) {
    this.step = step;
    this.context = context;
  }

  /** Whether the step changes what lines are drawn as: the map then redraws every frame while it plays. */
  public get changesIdentity(): boolean {
    return false;
  }

  /**
   * The points the camera should frame.
   *
   * @returns Points around the change.
   */
  public abstract cameraPoints(): LngLat[];

  /**
   * Where the change starts on the map, for a camera that follows it as it is drawn: its first point,
   * unless it grows from somewhere of its own.
   *
   * @returns The point, or `null` for a change with none.
   */
  public startPoint(): LngLat | null {
    return this.cameraPoints()[0] ?? null;
  }

  /**
   * Adds this frame of the step to the drawing.
   *
   * @param frame - The frame.
   * @param drawing - What the step adds to the map; filled in place.
   */
  public abstract draw(frame: StepFrame, drawing: StepDrawing): void;

  /**
   * Marks a station as reached by a line this frame, unless the line is hidden or the station has
   * not opened on it yet.
   *
   * @param frame - The frame.
   * @param drawing - The drawing to mark it in.
   * @param station - The station id.
   * @param line - The line reaching it.
   */
  protected reach(frame: StepFrame, drawing: StepDrawing, station: string, line: string): void {
    const { state } = frame;
    if (!state.visibleLines.has(line) || !state.timeline.servesStation(station, line, state.cursor)) return;
    const resolved = resolveLine(state, line);
    const served = drawing.reached.get(station) ?? new Map();
    served.set(resolved.id, resolved.color);
    drawing.reached.set(station, served);
  }

  /** The step's date for a caption: `null` for a planned step, which has none. */
  protected get date(): number | null {
    return this.step.planned ? null : this.step.time;
  }

  /**
   * A station's name on the step's date.
   *
   * @param station - The station id.
   * @param time - When; the step's own date by default.
   * @returns Its display name then.
   */
  protected nameOf(station: string, time = this.step.time): string {
    return this.context.index.stationName(station, time);
  }
}

/**
 * A stretch of line opening: it grows out of the network along the real track at one speed, and the
 * front stops at each new station as it pops in, pulses and is labelled. A long stretch takes longer,
 * never faster; a short one is quick, never drawn out.
 */
export class OpenStepAnimation extends StepAnimation<OpenStep> {
  /** Seconds at 1×: each run between stops at the view's pace, as a train runs it, and a stop at each new station. */
  public readonly drawSeconds: number;
  /** Seconds at 1× its new stations stay highlighted. */
  public readonly holdSeconds = OPEN_HOLD_SECONDS;
  /** Where the stretch grows from and in what order its stations appear. */
  public readonly growth: Growth;
  /** Where along the stretch the front stops: each new station, km. */
  private readonly stops: number[];
  /** The one way through the stretch a camera follows. */
  private readonly path: SegmentPlan[];
  /** The lines of the step on each of its segments. */
  private readonly linesBySegment = new Map<number, string[]>();
  /** The lines of the step at each of its stations. */
  private readonly linesByStation = new Map<string, string[]>();

  public constructor(step: OpenStep, context: StepContext) {
    super(step, context);
    this.growth = context.timeline.growthOf(step);
    this.stops = this.growth.reach.filter(reached => reached.isNew).map(reached => reached.km);
    this.path = mainPathOf(this.growth.plans);
    const pace = GROWTH_PACE[context.view];
    this.drawSeconds = Math.max(MIN_DRAW_SECONDS, growthSeconds(this.stops, this.growth.totalKm, pace));
    for (const { segment, line } of step.lineSegments) {
      pushTo(this.linesBySegment, segment.index, line);
      for (const station of [segment.stationA, segment.stationB]) pushTo(this.linesByStation, station, line);
    }
  }

  /**
   * Frames the new stretch.
   *
   * @returns Every point of its track.
   */
  public cameraPoints(): LngLat[] {
    return this.step.segments.flatMap(segment => segment.coordinates);
  }

  /**
   * Where the stretch starts growing: the end of its first segment the growth leaves from.
   *
   * @returns The point.
   */
  public override startPoint(): LngLat | null {
    const first = this.growth.plans.reduce<SegmentPlan | null>((earliest, plan) => (!earliest || plan.startKm < earliest.startKm ? plan : earliest), null);
    if (!first) return null;
    return (first.fromStationA ? first.segment.coordinates[0] : first.segment.reversedCoordinates[0]) ?? null;
  }

  /**
   * Draws each segment up to the growth front, a glowing head where it is still growing, marks the
   * stations the front has passed, and links each to the stations it changes to, as it gets there.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const frontKm = frontKmAt(frame.progress * this.drawSeconds, this.stops, this.growth.totalKm, GROWTH_PACE[this.context.view]);
    for (const plan of this.growth.plans) this.drawSegment(frame, drawing, plan, frontKm);
    if (this.path.length > 0) drawing.chase = chaseAlong(this.path, frontKm);
    for (const reached of this.growth.reach) {
      if (reached.km > frontKm + 1e-9) break;
      for (const line of this.linesByStation.get(reached.station) ?? []) this.reach(frame, drawing, reached.station, line);
      if (reached.isNew && drawing.reached.has(reached.station)) drawing.highlighted.add(reached.station);
    }
    this.linkTransfers(frame, drawing);
  }

  /**
   * Links each station the front has reached to the stations it changes to, on the map or reached
   * too, where the map had no link yet: the interchange shows as the front gets there, not once the
   * whole stretch has drawn.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  private linkTransfers(frame: StepFrame, drawing: StepDrawing): void {
    const { index } = this.context;
    const onMap = (station: string) => frame.snapshot.stations.has(station) || drawing.reached.has(station);
    for (const station of drawing.reached.keys()) {
      for (const other of index.transfersAt(station)) {
        const known = frame.snapshot.linked.has(station) && frame.snapshot.linked.has(other);
        // Each pair once: from the first of the two, or from the one reached if only it is.
        if (known || !onMap(other) || (drawing.reached.has(other) && other < station)) continue;
        drawing.links.features.push(lineFeature([index.coordOf(station), index.coordOf(other)], '', 0));
        drawing.linked.add(station).add(other);
      }
    }
  }

  /**
   * Draws one segment as far as the growth front has got along it.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   * @param plan - The segment's plan.
   * @param frontKm - How far the growth front has travelled.
   */
  private drawSegment(frame: StepFrame, drawing: StepDrawing, plan: SegmentPlan, frontKm: number): void {
    const { segment } = plan;
    const lines = (this.linesBySegment.get(segment.index) ?? []).filter(line => frame.state.visibleLines.has(line));
    const drawnKm = Math.min(segment.lengthKm, frontKm - plan.startKm);
    if (lines.length === 0 || drawnKm <= 0) return;
    const coordinates = plan.fromStationA
      ? sliceAlong(segment.coordinates, segment.distances, drawnKm)
      : sliceAlong(segment.reversedCoordinates, segment.reversedDistances, drawnKm);
    const resolved = new Map(lines.map(line => resolveLine(frame.state, line)).map(line => [line.id, line.color]));
    // Offsets are relative to the direction the points run, so a segment drawn B→A flips its side.
    const direction = plan.fromStationA ? 1 : -1;
    const highlight = 1 - frame.holdProgress;
    for (const [lineId, color] of resolved)
      drawing.lines.features.push(lineFeature(coordinates, color, offsetFor(frame.snapshot.sideBySide, segment, lineId) * direction, highlight));
    const tip = coordinates.at(-1);
    const tipColor = [...resolved.values()][0];
    if (drawnKm < segment.lengthKm && tip && tipColor) drawing.heads.features.push(pointFeature(tip, { color: tipColor }));
  }
}

/** Sections closing: the track retracts towards the end that stays on the map, leaving a dashed ghost. */
export class CloseStepAnimation extends StepAnimation<CloseStep> {
  /** Seconds at 1× for the track to retract. */
  public readonly drawSeconds = CLOSE_DRAW_SECONDS;
  /** Seconds at 1× before the next step. */
  public readonly holdSeconds = CLOSE_HOLD_SECONDS;

  public constructor(step: CloseStep, context: StepContext) {
    super(step, context);
  }

  /**
   * Frames the closing track.
   *
   * @returns Every point of it.
   */
  public cameraPoints(): LngLat[] {
    return this.step.lineSegments.flatMap(lineSegment => lineSegment.segment.coordinates);
  }

  /**
   * Draws what is left of each closing segment, and fades stations left with no line.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const { closingOnly, sideBySide } = frame.snapshot;
    const stays = (station: string) => !closingOnly.has(station);
    for (const { segment, line } of this.step.lineSegments) {
      const remainingKm = (1 - easeInOut(frame.progress)) * segment.lengthKm;
      if (!frame.state.visibleLines.has(line) || remainingKm <= 0) continue;
      const fromStationA = stays(segment.stationA) || !stays(segment.stationB);
      const coordinates = fromStationA
        ? sliceAlong(segment.coordinates, segment.distances, remainingKm)
        : sliceAlong(segment.reversedCoordinates, segment.reversedDistances, remainingKm);
      const resolved = resolveLine(frame.state, line);
      drawing.lines.features.push(lineFeature(coordinates, resolved.color, offsetFor(sideBySide, segment, resolved.id) * (fromStationA ? 1 : -1)));
    }
    for (const station of closingOnly) drawing.fading.set(station, 1 - easeInOut(frame.progress));
  }
}

/** A station opening on track its lines already run over: it pops in on the line. */
export class InfillStepAnimation extends StepAnimation<InfillStep> {
  /** Seconds at 1× for the station to appear. */
  public readonly drawSeconds = INFILL_DRAW_SECONDS;
  /** Seconds at 1× it stays highlighted. */
  public readonly holdSeconds = INFILL_HOLD_SECONDS;

  public constructor(step: InfillStep, context: StepContext) {
    super(step, context);
  }

  /**
   * Frames the station.
   *
   * @returns Its coordinate.
   */
  public cameraPoints(): LngLat[] {
    return [this.context.index.coordOf(this.step.station)];
  }

  /**
   * Adds the station to its lines and highlights it. Its lines call there once this step has played,
   * so it is asked of the network as it stands after it.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const after = { ...frame, state: { ...frame.state, cursor: this.step.index + 1 } };
    for (const line of this.step.lines) this.reach(after, drawing, this.step.station, line);
    if (drawing.reached.has(this.step.station)) drawing.highlighted.add(this.step.station);
  }
}

/**
 * Lines stop calling at a station they still run through: the track stays, and
 * the dot fades out unless another line still calls there.
 */
export class StationCloseStepAnimation extends StepAnimation<StationCloseStep> {
  /** Seconds at 1× for the station to fade. */
  public readonly drawSeconds = STATION_CLOSE_DRAW_SECONDS;
  /** Seconds at 1× before the next step. */
  public readonly holdSeconds = STATION_CLOSE_HOLD_SECONDS;

  public constructor(step: StationCloseStep, context: StepContext) {
    super(step, context);
  }

  /**
   * Frames the station.
   *
   * @returns Its coordinate.
   */
  public cameraPoints(): LngLat[] {
    return [this.context.index.coordOf(this.step.station)];
  }

  /**
   * Fades the station out where no other line still calls there.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const { station } = this.step;
    const { state } = frame;
    // By the lines themselves, not as drawn: a line drawn as a closing one may still call here.
    const staysServed = this.context.index
      .lineSegmentsAt(station)
      .some(
        lineSegment =>
          !this.step.lines.includes(lineSegment.line) &&
          state.visibleLines.has(lineSegment.line) &&
          state.timeline.isOpen(lineSegment, state.cursor) &&
          state.timeline.servesStation(station, lineSegment.line, state.cursor),
      );
    if (frame.snapshot.stations.has(station) && !staysServed) drawing.fading.set(station, 1 - easeInOut(frame.progress));
  }
}

/** A station takes a new name: it pulses, labelled with its new name over its old. */
export class RenameStepAnimation extends StepAnimation<RenameStep> {
  /** Seconds at 1× before the station pulses. */
  public readonly drawSeconds = RENAME_DRAW_SECONDS;
  /** Seconds at 1× it stays highlighted under its new name. */
  public readonly holdSeconds = RENAME_HOLD_SECONDS;

  public constructor(step: RenameStep, context: StepContext) {
    super(step, context);
  }

  /**
   * Frames the station.
   *
   * @returns Its coordinate.
   */
  public cameraPoints(): LngLat[] {
    return [this.context.index.coordOf(this.step.station)];
  }

  /**
   * Highlights the station, which the map labels with its name on the step's date, the new one,
   * and the one it had.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    if (!frame.snapshot.stations.has(this.step.station)) return;
    drawing.highlighted.add(this.step.station);
    drawing.renamed.set(this.step.station, this.step.from);
  }
}

/**
 * Lines taking their own identity (one line splitting into several): their track, already on the
 * map, changes colour and separates. The colour blend is drawn by the network layer, which redraws
 * every frame while `changesIdentity` is true; this step adds nothing of its own.
 */
export class IdentityStepAnimation extends StepAnimation<IdentityStep> {
  /** Seconds at 1× for the colour change. */
  public readonly drawSeconds = IDENTITY_DRAW_SECONDS;
  /** Seconds at 1× before the next step. */
  public readonly holdSeconds = IDENTITY_HOLD_SECONDS;

  public constructor(step: IdentityStep, context: StepContext) {
    super(step, context);
  }

  /** Always: this step is a change of identity. */
  public override get changesIdentity(): boolean {
    return true;
  }

  /**
   * Frames every segment of the lines changing.
   *
   * @returns Every point of their track.
   */
  public cameraPoints(): LngLat[] {
    return this.context.index.lineSegments
      .filter(lineSegment => this.step.lines.includes(lineSegment.line))
      .flatMap(lineSegment => lineSegment.segment.coordinates);
  }

  /**
   * Nothing to add: the network layer draws the blend.
   *
   * @param _frame - Unused.
   * @param _drawing - Unused.
   */
  public draw(_frame: StepFrame, _drawing: StepDrawing): void {
    // The colour change is the network layer redrawing with blended colours.
  }
}
