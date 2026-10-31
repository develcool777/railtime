import type { LngLat } from '@railtime/core/geometry.types';
import { distanceKm } from '@railtime/core/geometry.utils';
import type { Growth, TrackSegment } from '../network/engine.types';
import { pushTo } from '@railtime/core/collection.utils';

/**
 * The unsettled station nearest the growth's start.
 *
 * @param distances - Distance found so far to each station.
 * @param settled - Stations whose distance is final.
 * @returns The station, or `null` when every reached station is settled.
 */
const nearestUnsettled = (distances: Map<string, number>, settled: Set<string>): string | null => {
  let nearest: string | null = null;
  let nearestKm = Infinity;
  for (const [station, km] of distances)
    if (!settled.has(station) && km < nearestKm) {
      nearest = station;
      nearestKm = km;
    }
  return nearest;
};

/**
 * How a stretch of new track grows: from one place, so its front moves one way and a camera can follow
 * it. It starts at an end of the stretch already on the map (an extension grows out of the network),
 * else at its end nearest the centre (a line between two stations, or crossing the network, grows from
 * one end through them); only a loop, which has no end, starts at a station on the map, else the one
 * nearest the centre. Each segment starts drawing when the front reaches its nearer end, so a stretch
 * that forks grows its branches side by side and stations are reached in order of distance.
 *
 * @param segments - The stretch's segments.
 * @param stationsOnMap - Stations on the map before the stretch opens.
 * @param coordOf - Where a station is.
 * @param centre - What a choice between two starts favours: the one nearer it.
 * @returns The growth plan.
 */
export const planGrowth = (segments: TrackSegment[], stationsOnMap: Set<string>, coordOf: (station: string) => LngLat, centre: LngLat): Growth => {
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of segments) for (const station of [segment.stationA, segment.stationB]) pushTo(segmentsAt, station, segment);
  const stations = [...segmentsAt.keys()];
  const nearCentre = (first: string, second: string) => distanceKm(coordOf(first), centre) - distanceKm(coordOf(second), centre);
  const ends = stations.filter(station => segmentsAt.get(station)?.length === 1);
  const onMap = (candidates: string[]) => candidates.filter(station => stationsOnMap.has(station));
  const [source] =
    [onMap(ends), ends, onMap(stations), stations].map(candidates => candidates.slice().sort(nearCentre)).find(candidates => candidates.length > 0) ?? [];
  const sources = source === undefined ? [] : [source];

  // Dijkstra over the stretch: the graphs are small, so a linear scan for the next station is fine.
  const distances = new Map(sources.map(station => [station, 0]));
  const settled = new Set<string>();
  for (let current = nearestUnsettled(distances, settled); current !== null; current = nearestUnsettled(distances, settled)) {
    settled.add(current);
    const currentKm = distances.get(current)!;
    for (const segment of segmentsAt.get(current) ?? []) {
      const other = segment.stationA === current ? segment.stationB : segment.stationA;
      if (currentKm + segment.lengthKm < (distances.get(other) ?? Infinity)) distances.set(other, currentKm + segment.lengthKm);
    }
  }

  const plans = segments.map(segment => {
    const kmToA = distances.get(segment.stationA) ?? 0;
    const kmToB = distances.get(segment.stationB) ?? 0;
    return { segment, fromStationA: kmToA <= kmToB, startKm: Math.min(kmToA, kmToB) };
  });
  return {
    plans,
    totalKm: Math.max(0.01, ...plans.map(plan => plan.startKm + plan.segment.lengthKm)),
    reach: [...distances.entries()].map(([station, km]) => ({ station, km, isNew: !stationsOnMap.has(station) })).sort((first, second) => first.km - second.km),
  };
};
