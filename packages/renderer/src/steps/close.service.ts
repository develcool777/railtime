import type { LngLat } from '@railtime/core/geometry.types';
import { lineFeature } from '../layers/features.utils';
import { offsetFor, resolveLine } from '../layers/lineStyle.utils';
import { sliceAlong } from '@railtime/core/geometry.utils';
import type { CloseStep } from '@railtime/network/engine.types';
import { CLOSE_DRAW_SECONDS, CLOSE_HOLD_SECONDS } from './animation.constants';
import { StepAnimation } from './animation.service';
import type { StepContext, StepDrawing, StepFrame } from './animation.types';

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
