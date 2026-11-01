import type { LngLat } from '@railtime/core/geometry.types';
import type { SegmentPlan, StationCloseStep, Step } from '@railtime/network/engine.types';
import type { StepContext, StepDrawing, StepFrame, Stretch } from './animation.types';
import { lineFeature, pointFeature } from '../layers/snapshot.utils';
import { offsetFor, resolveLine } from '../layers/style.utils';
import { sliceAlong } from '@railtime/core/geometry.utils';
import { clamp } from '@railtime/core/number.utils';
import { easeInOut } from '../support/drawing.utils';
import { arrivalSeconds, chaseAlong, frontKmAt, growthSeconds, stretchOf } from './animation.utils';
import { CLOSE_HOLD_SECONDS, GROWTH_PACE, MIN_DRAW_SECONDS, OPEN_HOLD_SECONDS, STEP_TIMES } from './animation.constants';

/**
 * How a step plays, whatever its kind: how long it takes, what the camera frames, and what it draws
 * each frame. A stretch opening grows along its track as a train runs, linking its interchanges as it
 * gets there; a stretch closing retracts the same way, back to the network that stays; a station
 * appears, fades, or pulses under a new name; lines blend into their own colours. Each kind's times
 * are `STEP_TIMES`'s, a stretch's its length's and stations'.
 */
export class StepAnimation {
  /** The step being played. */
  public readonly step: Step;
  /** Seconds at 1× for the change to animate. */
  public readonly drawSeconds: number;
  /** Seconds at 1× what changed stays marked afterwards. */
  public readonly holdSeconds: number;
  /** The stretch an opening grows or a closure retracts: `null` for any other kind. */
  public readonly stretch: Stretch | null;
  /** The network as it stood when the step started. */
  private readonly context: StepContext;

  public constructor(step: Step, context: StepContext) {
    this.step = step;
    this.context = context;
    if (step.kind === 'open' || step.kind === 'close') {
      const growth = step.kind === 'open' ? context.timeline.growthOf(step) : context.timeline.retreatOf(step);
      this.stretch = stretchOf(growth, step.lineSegments, step.kind === 'close');
      this.drawSeconds = Math.max(MIN_DRAW_SECONDS, growthSeconds(this.stretch.stops, growth.totalKm, GROWTH_PACE[context.view]));
      this.holdSeconds = step.kind === 'open' ? OPEN_HOLD_SECONDS : CLOSE_HOLD_SECONDS;
    } else {
      this.stretch = null;
      this.drawSeconds = STEP_TIMES[step.kind].drawSeconds;
      this.holdSeconds = STEP_TIMES[step.kind].holdSeconds;
    }
  }

  /** Whether the step changes what lines are drawn as: the map then redraws every frame while it plays. */
  public get changesIdentity(): boolean {
    return this.step.kind === 'identity';
  }

  /**
   * The points the camera should frame: the new or closing track, the station, or every segment of
   * the lines changing colour that is on the map.
   *
   * @returns Points around the change.
   */
  public cameraPoints(): LngLat[] {
    const { step } = this;
    const { index } = this.context;
    switch (step.kind) {
      case 'open':
        return step.segments.flatMap(segment => segment.coordinates);
      case 'close':
        return step.lineSegments.flatMap(lineSegment => lineSegment.segment.coordinates);
      case 'identity':
        // What changes colour is what is on the map: not track the line has yet to open, or has left.
        return index.lineSegments
          .filter(lineSegment => step.lines.includes(lineSegment.line) && this.context.timeline.isOpen(lineSegment, step.index))
          .flatMap(lineSegment => lineSegment.segment.coordinates);
      default:
        return [index.coordOf(step.station)];
    }
  }

  /**
   * Where the change starts on the map, for a camera that follows it as it is drawn: where a stretch
   * starts growing, or its far end, where a closed one starts retracting; else the first point it frames.
   *
   * @returns The point, or `null` for a change with none.
   */
  public startPoint(): LngLat | null {
    if (!this.stretch) return this.cameraPoints()[0] ?? null;
    const { path, retracts } = this.stretch;
    const plan = retracts ? path.at(-1) : path[0];
    if (!plan) return null;
    const track = plan.fromStationA ? plan.segment.coordinates : plan.segment.reversedCoordinates;
    return (retracts ? track.at(-1) : track[0]) ?? null;
  }

  /**
   * Adds this frame of the step to the drawing.
   *
   * @param frame - The frame.
   * @param drawing - What the step adds to the map; filled in place.
   */
  public draw(frame: StepFrame, drawing: StepDrawing): void {
    const { step } = this;
    switch (step.kind) {
      case 'open':
        return this.drawOpening(frame, drawing);
      case 'close':
        return this.drawClosing(frame, drawing);
      case 'infill': {
        // Its lines call there once this step has played: asked of the network as it stands after it.
        const after = { ...frame, state: { ...frame.state, cursor: step.index + 1 } };
        for (const line of step.lines) this.reach(after, drawing, step.station, line);
        if (drawing.reached.has(step.station)) drawing.highlighted.add(step.station);
        return;
      }
      case 'stationClose':
        return this.drawStationClosing(step, frame, drawing);
      case 'rename':
        // The map labels it with its name on the step's date, the new one, over the one it had.
        if (!frame.snapshot.stations.has(step.station)) return;
        drawing.highlighted.add(step.station);
        drawing.renamed.set(step.station, step.from);
        return;
      case 'identity':
        // The network layer draws the blend, redrawing every frame while `changesIdentity`.
        return;
    }
  }

  /**
   * An opening: each segment drawn up to the growth front, a glowing head where it is still growing,
   * the stations the front has passed marked, each linked to the stations it changes to as it gets
   * there, and where a camera following it looks from.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  private drawOpening(frame: StepFrame, drawing: StepDrawing): void {
    if (!this.stretch) return;
    const { growth, stops, path, linesByStation } = this.stretch;
    const frontKm = frontKmAt(frame.progress * this.drawSeconds, stops, growth.totalKm, GROWTH_PACE[this.context.view]);
    for (const plan of growth.plans) this.drawSegment(frame, drawing, plan, frontKm);
    if (path.length > 0) drawing.chase = chaseAlong(path, frontKm);
    for (const reached of growth.reach) {
      if (reached.km > frontKm + 1e-9) break;
      for (const line of linesByStation.get(reached.station) ?? []) this.reach(frame, drawing, reached.station, line);
      if (reached.isNew && drawing.reached.has(reached.station)) drawing.highlighted.add(reached.station);
    }
    this.linkTransfers(frame, drawing);
  }

  /**
   * Draws one segment of a stretch as far as the front has got along it: grown so far, or what a
   * retreat has left. New track stands out; closing track does not.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   * @param plan - The segment's plan.
   * @param frontKm - How far the growth front has travelled.
   */
  private drawSegment(frame: StepFrame, drawing: StepDrawing, plan: SegmentPlan, frontKm: number): void {
    const { segment } = plan;
    const lines = (this.stretch?.linesBySegment.get(segment.index) ?? []).filter(line => frame.state.visibleLines.has(line));
    const drawnKm = Math.min(segment.lengthKm, frontKm - plan.startKm);
    if (lines.length === 0 || drawnKm <= 0) return;
    const coordinates = plan.fromStationA
      ? sliceAlong(segment.coordinates, segment.distances, drawnKm)
      : sliceAlong(segment.reversedCoordinates, segment.reversedDistances, drawnKm);
    const resolved = new Map(lines.map(line => resolveLine(frame.state, line)).map(line => [line.id, line.color]));
    // Offsets are relative to the direction the points run, so a segment drawn B→A flips its side.
    const direction = plan.fromStationA ? 1 : -1;
    if (!this.stretch?.retracts) drawing.highlight = 1 - frame.holdProgress;
    const into = drawnKm < segment.lengthKm ? drawing.growing : drawing.lines;
    for (const [lineId, color] of resolved)
      into.features.push(lineFeature(coordinates, color, offsetFor(frame.snapshot.sideBySide, segment, lineId) * direction, 1, '', this.step.planned));
    const tip = coordinates.at(-1);
    const tipColor = [...resolved.values()][0];
    if (drawnKm < segment.lengthKm && tip && tipColor) drawing.heads.features.push(pointFeature(tip, { color: tipColor }));
  }

  /**
   * Links each station an opening has reached to the stations it changes to, on the map or reached
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
   * A stretch closing: one front retracting from its far end back to the network that stays, at an
   * opening's pace, over the dashed ghost of what closes; a station left with no line fades while the
   * front stops at it, any other as the step plays.
   *
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  private drawClosing(frame: StepFrame, drawing: StepDrawing): void {
    if (!this.stretch) return;
    const { growth, stops, path } = this.stretch;
    const pace = GROWTH_PACE[this.context.view];
    const elapsed = frame.progress * this.drawSeconds;
    const frontKm = growth.totalKm - frontKmAt(elapsed, stops, growth.totalKm, pace);
    for (const plan of growth.plans) this.drawSegment(frame, drawing, plan, frontKm);
    if (path.length > 0) drawing.chase = chaseAlong(path, frontKm, true);
    const { closingOnly } = frame.snapshot;
    // The stations it takes off the map, in the order the front gets to them: the stops, each with its time.
    const leaving = growth.reach.filter(reached => reached.isNew).reverse();
    const arrivals = arrivalSeconds(stops, growth.totalKm, pace);
    for (const [order, reached] of leaving.entries()) {
      const arrived = arrivals[order];
      if (arrived !== undefined && closingOnly.has(reached.station))
        drawing.fading.set(reached.station, 1 - clamp((elapsed - arrived) / pace.stationSeconds, 0, 1));
    }
    for (const station of closingOnly) if (!drawing.fading.has(station)) drawing.fading.set(station, 1 - easeInOut(frame.progress));
  }

  /**
   * Lines stop calling at a station they still run through: the track stays, and the dot fades
   * unless another line still calls there.
   *
   * @param step - The step.
   * @param frame - The frame.
   * @param drawing - Filled in place.
   */
  private drawStationClosing(step: StationCloseStep, frame: StepFrame, drawing: StepDrawing): void {
    const { station } = step;
    const { state } = frame;
    // By the lines themselves, not as drawn: a line drawn as a closing one may still call here.
    const staysServed = this.context.index
      .lineSegmentsAt(station)
      .some(
        lineSegment =>
          !step.lines.includes(lineSegment.line) &&
          state.visibleLines.has(lineSegment.line) &&
          state.timeline.isOpen(lineSegment, state.cursor) &&
          state.timeline.servesStation(station, lineSegment.line, state.cursor),
      );
    if (frame.snapshot.stations.has(station) && !staysServed) drawing.fading.set(station, 1 - easeInOut(frame.progress));
  }

  /**
   * Marks a station as reached by a line this frame, unless the line is hidden or the station has
   * not opened on it yet.
   *
   * @param frame - The frame.
   * @param drawing - The drawing to mark it in.
   * @param station - The station id.
   * @param line - The line reaching it.
   */
  private reach(frame: StepFrame, drawing: StepDrawing, station: string, line: string): void {
    const { state } = frame;
    if (!state.visibleLines.has(line) || !state.timeline.servesStation(station, line, state.cursor)) return;
    const resolved = resolveLine(state, line);
    const served = drawing.reached.get(station) ?? new Map();
    served.set(resolved.id, resolved.color);
    drawing.reached.set(station, served);
  }
}
