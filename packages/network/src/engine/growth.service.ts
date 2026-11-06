import type { CloseStep, Growth, LineSegment, OpenStep } from './engine.types';
import type { NetworkIndex } from './index.service';
import type { Timeline } from './timeline.service';
import { planGrowth } from './timeline.utils.ts';

/**
 * How a change draws itself along its track: an opening's growth, a closure's retreat, each worked out
 * the first time it is asked for. Its caption and its animation both read them.
 */
export class Growths {
  /** The network, indexed. */
  private readonly index: NetworkIndex;
  /** Its history as steps: what is on the map before and after each. */
  private readonly timeline: Timeline;
  /** Each opening's growth and each closure's retreat, once worked out. */
  private readonly known = new WeakMap<OpenStep | CloseStep, Growth>();

  /**
   * @param index - The network, indexed.
   * @param timeline - Its history as steps.
   */
  public constructor(index: NetworkIndex, timeline: Timeline) {
    this.index = index;
    this.timeline = timeline;
  }

  /**
   * How an opening grows: from the stations on the map before it (else the end nearest the centre),
   * segment by segment, and the order its stations come in.
   *
   * @param step - The opening.
   * @returns Its growth, worked out once.
   */
  public growthOf(step: OpenStep): Growth {
    const known = this.known.get(step);
    if (known) return known;
    const planned = this.planned(step, step.segments, step.index);
    const growth = this.calledAtOnly(planned, step.lineSegments, step.index + 1);
    this.known.set(step, growth);
    return growth;
  }

  /**
   * How a closure retracts: its stretch planned as it would grow from the stations still on the map
   * after it (else the end nearest the centre), played backwards, so its front runs back to the
   * network that stays. A station `isNew` leaves the map with it, where its lines called.
   *
   * @param step - The closure.
   * @returns Its retreat as a growth, worked out once.
   */
  public retreatOf(step: CloseStep): Growth {
    const known = this.known.get(step);
    if (known) return known;
    const segments = [...new Map(step.lineSegments.map(({ segment }) => [segment.index, segment])).values()];
    const planned = this.planned(step, segments, step.index + 1);
    // While its closing step plays, a line still calls where it called.
    const growth = this.calledAtOnly(planned, step.lineSegments, step.index);
    this.known.set(step, growth);
    return growth;
  }

  /**
   * A stretch's growth on the track, out of what is on the map at a cursor.
   *
   * @param step - The change.
   * @param segments - Its track.
   * @param cursor - The cursor it grows from.
   * @returns The growth as planned.
   */
  private planned(step: OpenStep | CloseStep, segments: OpenStep['segments'], cursor: number): Growth {
    return planGrowth(
      segments,
      this.timeline.stationsOnMap(cursor),
      station => this.index.coordOf(station),
      this.index.centre,
      this.timeline.stationsOnLine(step.line, step.time, cursor),
    );
  }

  /**
   * A stretch's growth with only the stations its lines call at counted new: track running past a
   * station not yet open on them, or closed on them, is no stop.
   *
   * @param planned - The growth as planned on the track.
   * @param lineSegments - The stretch's line segments.
   * @param cursor - The cursor its lines' stops are asked at.
   * @returns The growth.
   */
  private calledAtOnly(planned: Growth, lineSegments: LineSegment[], cursor: number): Growth {
    const calledAt = (station: LineSegment['segment']['stationA']) =>
      lineSegments.some(
        ({ segment, line }) => (segment.stationA === station || segment.stationB === station) && this.timeline.servesStation(station, line, cursor),
      );
    return { ...planned, reach: planned.reach.map(reached => ({ ...reached, isNew: reached.isNew && calledAt(reached.station) })) };
  }
}
