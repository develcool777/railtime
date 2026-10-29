import type { LngLat } from '@railtime/schema/network.types';
import { required } from '../core/required.utils';
import { lineFeature, pointFeature } from '../layers/features.utils';
import type { RenderState } from '../layers/lineStyle.types';
import { offsetFor, resolveLine } from '../layers/lineStyle.utils';
import { sliceAlong } from '../model/geometry.utils';
import type { OpenStep } from '../model/timeline.types';
import { clamp } from '../playback/easing.utils';
import type { Growth, SegmentPlan } from '../playback/growth.types';
import { planGrowth } from '../playback/growth.utils';
import type { StepInfo } from '../transitMap.types';
import { GROWTH_KM_PER_SECOND, HOLD_BASE_SECONDS, HOLD_PER_STATION_SECONDS, MAX_DRAW_SECONDS, MAX_HOLD_SECONDS, MIN_DRAW_SECONDS } from './step.constants';
import { StepAnimation } from './stepAnimation.service';
import type { StepContext, StepDrawing, StepFrame } from './stepAnimation.types';

/**
 * A stretch of line opening: it grows out of the network along the real track, and each new station
 * pops in, pulses and is labelled as the growth front reaches it.
 */
export class OpenStepAnimation extends StepAnimation<OpenStep> {
  /** Seconds at 1×, by the stretch's length. */
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
    const { index } = context;
    this.growth = planGrowth(step.segments, context.stationsBefore, station => index.coordOf(station), index.centre);
    const newStations = this.growth.reach.filter(reached => reached.isNew).length;
    this.drawSeconds = clamp(this.growth.totalKm / GROWTH_KM_PER_SECOND, MIN_DRAW_SECONDS, MAX_DRAW_SECONDS);
    this.holdSeconds = Math.min(MAX_HOLD_SECONDS, HOLD_BASE_SECONDS + HOLD_PER_STATION_SECONDS * newStations);
    for (const { segment, line } of step.lineSegments) {
      this.linesBySegment.set(segment.index, [...(this.linesBySegment.get(segment.index) ?? []), line]);
      for (const station of [segment.stationA, segment.stationB]) this.linesByStation.set(station, [...(this.linesByStation.get(station) ?? []), line]);
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
   * "Victoria line opens" or "… extended", from the first station to the last reached.
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    const { index, timeline } = this.context;
    const { reach } = this.growth;
    const existed = index.lineSegments.some(
      lineSegment => timeline.isOpen(lineSegment, this.step.index) && timeline.identityOf(lineSegment.line, this.step.index).id === this.step.line,
    );
    return {
      kind: 'open',
      time: this.step.time,
      title: `${index.lineName(this.step.line)} ${existed ? 'extended' : 'opens'}`,
      subtitle: `${this.nameOf(required(reach[0], 'first station reached').station)} – ${this.nameOf(required(reach.at(-1), 'last station reached').station)}`,
      color: state.baseColor(this.step.line),
      stations: reach.filter(reached => reached.isNew).map(reached => this.nameOf(reached.station)),
    };
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
