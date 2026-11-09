import { lineId, stationId } from '@railtime/schema/testing/ids';
import type { TrackSegment } from '../../../src/engine/engine.types';
import type { TrainRun } from '../../../src/trains/trains.types';

/** A segment's tracks where its lines share one. */
const ONE_TRACK: TrackSegment['tracks'] = [];

/**
 * A stretch of track, as trains run on it.
 *
 * @param index - Its place among the network's.
 * @param lengthKm - How long it is.
 * @param tracks - Its lines on each track, where they do not share one.
 * @returns The stretch.
 */
export const trackOf = (index: number, lengthKm: number, tracks: TrackSegment['tracks'] = ONE_TRACK): TrackSegment =>
  ({ index, lengthKm, tracks }) as TrackSegment;

/**
 * A metro route along stretches of track, each way along them, stopping at each end.
 *
 * @param segments - Its stretches.
 * @param options - What else it is.
 * @param options.line - Its line.
 * @param options.ends - The stations it runs between: the same for a loop.
 * @returns The route.
 */
export const trainRunOf = (segments: TrackSegment[], { line = 'red', ends = ['a', 'b'] } = {}): TrainRun => {
  let lengthKm = 0;
  const legs = segments.map(segment => {
    const startKm = lengthKm;
    lengthKm += segment.lengthKm;
    return { segment, forward: true, startKm };
  });
  return { line: lineId(line), mode: 'metro', ends: [stationId(ends[0] ?? 'a'), stationId(ends[1] ?? 'b')], legs, lengthKm, stopsKm: [0, lengthKm] };
};
