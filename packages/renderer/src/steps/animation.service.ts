import type { LngLat } from '@railtime/core/geometry.types';
import type { CloseStep, Growth, IdentityStep, InfillStep, OpenStep, RenameStep, SegmentPlan, StationCloseStep, Step } from '@railtime/network/engine.types';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';
import { pushTo } from '@railtime/core/collection.utils';
import { lineFeature, pointFeature } from '../layers/snapshot.utils';
import { offsetFor, resolveLine } from '../layers/style.utils';
import { sliceAlong } from '@railtime/core/geometry.utils';
import { clamp } from '@railtime/core/number.utils';
import {
  CLOSE_DRAW_SECONDS,
  CLOSE_HOLD_SECONDS,
  GROWTH_PACE,
  HOLD_BASE_SECONDS,
  HOLD_PER_STATION_SECONDS,
  IDENTITY_DRAW_SECONDS,
  IDENTITY_HOLD_SECONDS,
  INFILL_DRAW_SECONDS,
  INFILL_HOLD_SECONDS,
  MAX_HOLD_SECONDS,
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
 * A stretch of line opening: it grows out of the network along the real track, and each new station
 * pops in, pulses and is labelled as the growth front reaches it.
 */
export class OpenStepAnimation extends StepAnimation<OpenStep> {
  /** Seconds at 1×, by the stretch's length and how the map is seen. */
  public readonly drawSeconds: number;
  /** Seconds at 1×, longer for more new stations. */
  public readonly holdSeconds: number;
  /** Where the stretch grows from and in what order its stations appear. */
  public readonly growth: Growth;
  /** The lines of the step on each of its segments. */
  private readonly linesBySegment = new Map<number, string[]>();
  /** The lines of the step at each of its stations. */
  private readonly linesByStation = new Map<string, string[]>();

  public constructor(step: OpenStep, context: StepContext) {
    super(step, context);
    this.growth = context.timeline.growthOf(step);
    const newStations = this.growth.reach.filter(reached => reached.isNew).length;
    const pace = GROWTH_PACE[context.view];
    this.drawSeconds = clamp(this.growth.totalKm / pace.kmPerSecond, pace.minSeconds, pace.maxSeconds);
    this.holdSeconds = Math.min(MAX_HOLD_SECONDS, HOLD_BASE_SECONDS + HOLD_PER_STATION_SECONDS * newStations);
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
   * Draws each segment up to the growth front, a glowing head where it is still growing, and marks
   * the stations the front has passed.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const frontKm = frame.progress * this.growth.totalKm;
    for (const plan of this.growth.plans) this.drawSegment(frame, drawing, plan, frontKm);
    for (const reached of this.growth.reach) {
      if (reached.km > frontKm + 1e-9) break;
      for (const line of this.linesByStation.get(reached.station) ?? []) this.reach(frame, drawing, reached.station, line);
      if (reached.isNew && drawing.reached.has(reached.station)) drawing.highlighted.add(reached.station);
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
      const remainingKm = (1 - frame.progress) * segment.lengthKm;
      if (!frame.state.visibleLines.has(line) || remainingKm <= 0) continue;
      const fromStationA = stays(segment.stationA) || !stays(segment.stationB);
      const coordinates = fromStationA
        ? sliceAlong(segment.coordinates, segment.distances, remainingKm)
        : sliceAlong(segment.reversedCoordinates, segment.reversedDistances, remainingKm);
      const resolved = resolveLine(frame.state, line);
      drawing.lines.features.push(lineFeature(coordinates, resolved.color, offsetFor(sideBySide, segment, resolved.id) * (fromStationA ? 1 : -1)));
    }
    for (const station of closingOnly) drawing.fading.set(station, 1 - frame.progress);
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
    if (frame.snapshot.stations.has(station) && !staysServed) drawing.fading.set(station, 1 - frame.progress);
  }
}

/** A station takes a new name: it pulses, labelled with it. */
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
   * Highlights the station, which the map labels with its name on the step's date: the new one.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    if (frame.snapshot.stations.has(this.step.station)) drawing.highlighted.add(this.step.station);
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
