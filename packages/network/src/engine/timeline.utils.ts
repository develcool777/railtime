import { pushTo } from '@railtime/core/collection.utils';
import type { LngLat } from '@railtime/core/geometry.types';
import { distanceKm } from '@railtime/core/geometry.utils';
import type { Growth, LineSegment, TrackSegment } from './engine.types';

/**
 * Splits one day's openings, or closures, for one line into connected stretches, nearest the
 * network's centre first. Each stretch plays as its own step.
 *
 * @param lineSegments - The line segments opening or closing.
 * @param coordOf - Where a station is.
 * @param centre - The network's centre.
 * @returns The stretches.
 */
export const connectedStretches = (lineSegments: LineSegment[], coordOf: (station: string) => LngLat, centre: LngLat): LineSegment[][] => {
  const bySegment = new Map<TrackSegment, LineSegment[]>();
  for (const lineSegment of lineSegments) pushTo(bySegment, lineSegment.segment, lineSegment);
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of bySegment.keys()) for (const station of [segment.stationA, segment.stationB]) pushTo(segmentsAt, station, segment);

  const seen = new Set<TrackSegment>();
  const stretches: { lineSegments: LineSegment[]; distanceToCentre: number }[] = [];
  for (const start of bySegment.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const queue = [start];
    const stretch: LineSegment[] = [];
    let distanceToCentre = Infinity;
    while (queue.length > 0) {
      const segment = queue.pop()!;
      stretch.push(...bySegment.get(segment)!);
      for (const station of [segment.stationA, segment.stationB]) {
        distanceToCentre = Math.min(distanceToCentre, distanceKm(coordOf(station), centre));
        for (const next of segmentsAt.get(station)!) {
          if (seen.has(next)) continue;
          seen.add(next);
          queue.push(next);
        }
      }
    }
    stretches.push({ lineSegments: stretch, distanceToCentre });
  }
  return stretches.sort((first, second) => first.distanceToCentre - second.distanceToCentre).map(stretch => stretch.lineSegments);
};

/**
 * Splits a stretch opening at once where it forks, so each part grows as one front a camera can
 * follow: the longest way from where it starts, then each branch leaving that way at one station,
 * grown from there (split again where it forks). Track joining that way at two stations, a loop,
 * grows with it, side by side.
 *
 * @param stretch - A connected stretch's line segments.
 * @param stationsOnMap - Stations on the map before it opens.
 * @param coordOf - Where a station is.
 * @param centre - The network's centre.
 * @param stationsOnLine - Those of them on the stretch's own line: it grows out of its line first.
 * @returns Its parts, in the order they open.
 */
export const forkedParts = (
  stretch: LineSegment[],
  stationsOnMap: Set<string>,
  coordOf: (station: string) => LngLat,
  centre: LngLat,
  stationsOnLine: Set<string> = new Set(),
): LineSegment[][] => {
  const growth = planGrowth([...new Set(stretch.map(lineSegment => lineSegment.segment))], stationsOnMap, coordOf, centre, stationsOnLine);
  const kmAt = new Map(growth.reach.map(reached => [reached.station, reached.km]));
  // The longest way: back from the farthest station, each segment the one the front reached it by.
  const way = new Set<TrackSegment>();
  for (let station = growth.reach.at(-1)?.station; station !== undefined;) {
    const reachedBy = growth.plans.find(
      plan =>
        !way.has(plan.segment) &&
        (plan.fromStationA ? plan.segment.stationB : plan.segment.stationA) === station &&
        Math.abs(plan.startKm + plan.segment.lengthKm - (kmAt.get(station) ?? 0)) < 1e-6,
    );
    if (!reachedBy) break;
    way.add(reachedBy.segment);
    station = reachedBy.fromStationA ? reachedBy.segment.stationA : reachedBy.segment.stationB;
  }
  const first = stretch.filter(lineSegment => way.has(lineSegment.segment));
  const rest = stretch.filter(lineSegment => !way.has(lineSegment.segment));
  if (first.length === 0 || rest.length === 0) return [stretch];
  const onWay = new Set([...way].flatMap(segment => [segment.stationA, segment.stationB]));
  const branches: LineSegment[][] = [];
  for (const part of connectedStretches(rest, coordOf, centre)) {
    const forks = new Set(part.flatMap(({ segment }) => [segment.stationA, segment.stationB]).filter(station => onWay.has(station)));
    if (forks.size === 1) branches.push(part);
    else first.push(...part);
  }
  const firstStations = first.flatMap(({ segment }) => [segment.stationA, segment.stationB]);
  const drawn = new Set([...stationsOnMap, ...firstStations]);
  const onLine = new Set([...stationsOnLine, ...firstStations]);
  return [first, ...branches.flatMap(branch => forkedParts(branch, drawn, coordOf, centre, onLine))];
};

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
 * it. It starts at an end of the stretch already on its own line (an extension grows out of the line it
 * extends, though its far end meets another line), else one on the map (it grows out of the network),
 * else at its end nearest the centre (a line between two stations, or crossing the network, grows from
 * one end through them); only a loop, which has no end, starts at a station on the map, else the one
 * nearest the centre. Each segment starts drawing when the front reaches its nearer end, so a stretch
 * that forks grows its branches side by side (a timeline opens them one by one: `forkedParts`) and stations are reached in order of distance.
 *
 * @param segments - The stretch's segments.
 * @param stationsOnMap - Stations on the map before the stretch opens.
 * @param coordOf - Where a station is.
 * @param centre - What a choice between two starts favours: the one nearer it.
 * @param stationsOnLine - Those of the stations on the map on the stretch's own line.
 * @returns The growth plan.
 */
export const planGrowth = (
  segments: TrackSegment[],
  stationsOnMap: Set<string>,
  coordOf: (station: string) => LngLat,
  centre: LngLat,
  stationsOnLine: Set<string> = new Set(),
): Growth => {
  const segmentsAt = new Map<string, TrackSegment[]>();
  for (const segment of segments) for (const station of [segment.stationA, segment.stationB]) pushTo(segmentsAt, station, segment);
  const stations = [...segmentsAt.keys()];
  const nearCentre = (first: string, second: string) => distanceKm(coordOf(first), centre) - distanceKm(coordOf(second), centre);
  const ends = stations.filter(station => segmentsAt.get(station)?.length === 1);
  const onMap = (candidates: string[]) => candidates.filter(station => stationsOnMap.has(station));
  const [source] =
    [ends.filter(station => stationsOnLine.has(station)), onMap(ends), ends, onMap(stations), stations]
      .map(candidates => candidates.slice().sort(nearCentre))
      .find(candidates => candidates.length > 0) ?? [];
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
