import { pushTo } from '@railtime/core/collection.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { lineFeature, pointFeature } from '../layers/features.utils';
import { offsetFor, resolveLine } from '../layers/lineStyle.utils';
import { sliceAlong } from '@railtime/core/geometry.utils';
import type { Growth, OpenStep, SegmentPlan } from '@railtime/network/engine.types';
import { clamp } from '@railtime/core/number.utils';
import { GROWTH_PACE, HOLD_BASE_SECONDS, HOLD_PER_STATION_SECONDS, MAX_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

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
