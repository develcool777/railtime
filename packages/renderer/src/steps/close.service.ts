import type { LngLat } from '@railtime/schema/network.types';
import { lineFeature } from '../layers/features.utils';
import type { RenderState } from '../layers/lineStyle.types';
import { offsetFor, resolveLine } from '../layers/lineStyle.utils';
import { sliceAlong } from '../core/geometry.utils';
import type { CloseStep } from '../network/timeline.types';
import type { StepInfo } from '../transitMap.types';
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
   * "<line>: section closes", or "… suspended" when the line will return, with the stations it
   * ran between.
   *
   * @param state - The render state when the step starts.
   * @returns The caption.
   */
  public describe(state: RenderState): StepInfo {
    const ends = this.step.lineSegments.flatMap(({ segment }) => [this.nameOf(segment.stationA), this.nameOf(segment.stationB)]);
    const returns = this.step.lineSegments.every(lineSegment => lineSegment.next !== null);
    return {
      kind: 'close',
      time: this.date,
      title: `${this.context.index.lineName(this.step.line)}: section ${returns ? 'suspended' : 'closes'}`,
      subtitle: [...new Set(ends)].join(' – '),
      color: state.baseColor(this.step.line),
      stations: [],
    };
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
