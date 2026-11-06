import type { LngLat } from '@railtime/core/geometry.types';
import { sliceAlong } from '@railtime/core/geometry.utils';
import { required } from '@railtime/core/required.utils';
import type { TrackSegment } from '@railtime/network/engine.types';
import type { TrainLeg, TrainPlace } from '@railtime/network/trains.types';
import type { FeatureCollection, LineFeature } from './snapshot.types';
import { lineFeature } from './snapshot.utils';
import type { RenderState, SideBySide } from './style.types';
import { offsetFor, resolveLine } from './style.utils';
import { TRAIN_LENGTH_KM } from './trains.constants';

/**
 * A stretch of a segment's track, in its own direction.
 *
 * @param segment - The segment.
 * @param fromKm - Where the stretch starts along it.
 * @param toKm - Where it ends.
 * @returns The stretch's points.
 */
export const stretchOf = ({ coordinates, distances }: TrackSegment, fromKm: number, toKm: number): LngLat[] => {
  const inside = coordinates.filter((_point, place) => (distances[place] ?? 0) > fromKm && (distances[place] ?? 0) < toKm);
  const edge = (km: number): LngLat => required(sliceAlong(coordinates, distances, km).at(-1), 'a segment is never empty');
  return [edge(fromKm), ...inside, edge(toKm)];
};

/**
 * The part of a stretch of a run on one leg, as far along the leg's segment in its own direction.
 *
 * @param leg - The leg.
 * @param fromKm - Where the stretch starts along the run.
 * @param toKm - Where it ends.
 * @returns From and to along the segment; `null` if none of it is on the leg.
 */
const onLeg = ({ segment, forward, startKm }: TrainLeg, fromKm: number, toKm: number): [number, number] | null => {
  const from = Math.max(fromKm - startKm, 0);
  const to = Math.min(toKm - startKm, segment.lengthKm);
  if (to <= from) return null;
  return forward ? [from, to] : [segment.lengthKm - to, segment.lengthKm - from];
};

/**
 * The stretch of a run a train takes up: behind it, as it heads on, but never off the run's ends,
 * where it stands whole.
 *
 * @param place - Where it is.
 * @returns From and to along the run.
 */
export const trainStretchOf = ({ run, km, heading }: TrainPlace): [number, number] => {
  if (heading === 1) {
    const front = Math.max(km, TRAIN_LENGTH_KM);
    return [front - TRAIN_LENGTH_KM, front];
  }
  const front = Math.min(km, run.lengthKm - TRAIN_LENGTH_KM);
  return [front, front + TRAIN_LENGTH_KM];
};

/**
 * The trains as the map draws them, each a short stretch of its line's track behind it: a stretch of
 * track, and not a point, so it sits where its line is drawn on track shared with others (`offsetFor`).
 *
 * @param places - Where each train is.
 * @param state - The frame's render state.
 * @param sideBySide - The lines on each segment.
 * @returns The trains' track.
 */
export const trainsAt = (places: TrainPlace[], state: RenderState, sideBySide: SideBySide): FeatureCollection<LineFeature> => {
  const features: LineFeature[] = [];
  for (const place of places) {
    const { id, color } = resolveLine(state, place.run.line);
    const [fromKm, toKm] = trainStretchOf(place);
    for (const leg of place.run.legs) {
      const stretch = onLeg(leg, fromKm, toKm);
      if (stretch) features.push(lineFeature(stretchOf(leg.segment, ...stretch), color, offsetFor(sideBySide, leg.segment, id), 0, place.run.line));
    }
  }
  return { type: 'FeatureCollection', features };
};
