import type { LngLat } from '@railtime/schema/network.types';
import { distanceKm } from '../model/geometry.utils';
import type { TrackSegment } from '../model/networkIndex.types';
import { pushTo } from '../model/timeline.utils';
import type { Growth } from './growth.types';

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
 * How a stretch of new track grows: out of the stations already on the map, or, for a stretch that
 * touches none, from its end nearest the centre. Each segment starts drawing when the growth front
 * reaches its nearer end, so branches grow side by side and stations are reached in order of distance.
 *
 * @param segments - The stretch's segments.
 * @param stationsOnMap - Stations on the map before the stretch opens.
 * @param coordOf - Where a station is.
 * @param centre - Where a stretch touching nothing grows from.
 * @returns The growth plan.
 */
export const planGrowth = (segments: TrackSegment[], stationsOnMap: Set<string>, coordOf: (station: string) => LngLat, centre: LngLat): Growth => {
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of segments) for (const station of [segment.stationA, segment.stationB]) pushTo(segmentsAt, station, segment);
  const stations = [...segmentsAt.keys()];
  const nearCentre = (first: string, second: string) => distanceKm(coordOf(first), centre) - distanceKm(coordOf(second), centre);
  const connected = stations.filter(station => stationsOnMap.has(station));
  const sources = connected.length > 0 ? connected : stations.slice().sort(nearCentre).slice(0, 1);

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
