import type { NetworkEngine } from '@railtime/network/engine.service';
import { required } from '@railtime/core/required.utils';
import type { PointFeature, ReachStopProperties, ReachTrackFeature, RouteFeature, RouteStopProperties } from '../layers/snapshot.types';
import { pointFeature } from '../layers/snapshot.utils';
import type { CoverageCells, ReachInfo, RouteInfo, Theme } from '@railtime/network/facts.types';
import type { CoverageDrawing, RouteStopKind, RouteStopMark } from './overlay.types';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { channelsOf } from '../support/drawing.utils';
import { COVERAGE_ALPHA, UNCOVERED_ALPHA, UNCOVERED_COLOR } from './overlay.constants';

/**
 * A route's track: each ride along its segments in its line's colour, each walk straight from one
 * station to the other.
 *
 * @param index - The network.
 * @param route - The route, or `null`.
 * @param theme - The theme, for its lines' colours.
 * @returns Its stretches; none without a route.
 */
export const routeTrack = (index: NetworkEngine['index'], route: RouteInfo | null, theme: Theme): RouteFeature[] =>
  (route?.legs ?? []).flatMap((leg, position): RouteFeature[] => {
    if (leg.kind === 'walk') {
      return [
        {
          type: 'Feature',
          properties: { color: '', walk: true },
          geometry: { type: 'LineString', coordinates: [index.coordOf(leg.from.id), index.coordOf(leg.to.id)] },
        },
      ];
    }
    return (route?.segments[position] ?? []).map(segment => ({
      type: 'Feature',
      properties: { color: leg.color[theme], walk: false },
      geometry: { type: 'LineString', coordinates: required(index.segments[segment], `segment ${segment}`).coordinates },
    }));
  });

/**
 * A route's stops, marked where they are.
 *
 * @param index - The network.
 * @param route - The route, or `null`.
 * @param theme - The theme, for its lines' colours.
 * @returns Its stops; none without a route.
 */
export const routeStops = (index: NetworkEngine['index'], route: RouteInfo | null, theme: Theme): PointFeature<RouteStopProperties>[] =>
  route ? routeStopMarks(route, theme).map(mark => pointFeature(index.coordOf(mark.station), { kind: mark.kind, color: mark.color, name: mark.name })) : [];

/** Which mark a stop keeps when two legs give it one: a change outranks a stop passed, the end both; of two alike, the later (at a change, the line boarded). */
const RANK: Record<RouteStopKind, number> = { pass: 0, board: 1, end: 2 };

/**
 * The stops a route marks on the map, once each: every stop a ride passes, a ring where each ride
 * begins or ends (its start, and every change, a walk's included), and the end.
 *
 * @param route - The route.
 * @param theme - The theme, for its lines' colours.
 * @returns Each stop with its mark, in the order the route reaches them.
 */
export const routeStopMarks = (route: RouteInfo, theme: Theme): RouteStopMark[] => {
  const marks = new Map<string, RouteStopMark>();
  const mark = (station: string, name: string, kind: RouteStopKind, color: string) => {
    const known = marks.get(station);
    if (!known || RANK[kind] >= RANK[known.kind]) marks.set(station, { station, name, kind, color });
  };
  for (const leg of route.legs) {
    if (leg.kind !== 'ride') continue;
    // Where a ride begins or ends is a change, its start, or (marked below) its end.
    leg.stops.forEach((stop, place) => mark(stop.id, stop.name, place === 0 || place === leg.stops.length - 1 ? 'board' : 'pass', leg.color[theme]));
  }
  const lastRide = route.legs.findLast(leg => leg.kind === 'ride');
  mark(route.to.id, route.to.name, 'end', lastRide?.kind === 'ride' ? lastRide.color[theme] : '');
  return [...marks.values()];
};

/**
 * A band's colour.
 *
 * @param reach - The reach.
 * @param band - The band's place in its bands.
 * @returns Its colour.
 */
const bandColor = (reach: ReachInfo, band: number): string => required(reach.bands[band], `reach band ${band}`).color;

/**
 * The track a reach colours, each segment in its band's colour.
 *
 * @param index - The network.
 * @param reach - The reach, or `null`.
 * @returns The track; none without a reach.
 */
export const reachTrack = (index: NetworkEngine['index'], reach: ReachInfo | null): ReachTrackFeature[] => {
  if (!reach) return [];
  return reach.track.map(({ segment, band }) => ({
    type: 'Feature',
    properties: { color: bandColor(reach, band) },
    geometry: { type: 'LineString', coordinates: required(index.segments[segment], `segment ${segment}`).coordinates },
  }));
};

/**
 * The stations a reach gets to, each in its band's colour and named with its time, the start first.
 *
 * @param index - The network.
 * @param reach - The reach, or `null`.
 * @returns The stations; none without a reach.
 */
export const reachStops = (index: NetworkEngine['index'], reach: ReachInfo | null): PointFeature<ReachStopProperties>[] =>
  reach
    ? [
        pointFeature(index.coordOf(reach.from.id), { color: bandColor(reach, 0), label: reach.from.name, minutes: 0, origin: true }),
        ...reach.stations.map(station =>
          pointFeature(index.coordOf(station.id), {
            color: bandColor(reach, station.band),
            label: `${station.name} · ${Math.round(station.minutes)} min`,
            minutes: station.minutes,
            origin: false,
          }),
        ),
      ]
    : [];

/**
 * The city's coverage as an image, a pixel to a cell: each cell in its band's colour, the rest of the
 * city tinted, outside it clear.
 *
 * @param coverage - The city, cell by cell.
 * @returns RGBA pixels, row by row, the first row the northernmost.
 */
export const coverageImage = (coverage: CoverageCells): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(coverage.cells.length * 4);
  const colors = coverage.bands.map(band => [...channelsOf(band.color), COVERAGE_ALPHA]);
  const uncovered = [...channelsOf(UNCOVERED_COLOR), UNCOVERED_ALPHA];
  coverage.cells.forEach((band, cell) => {
    // Outside the city stays clear; past the last band is the city beyond them all.
    if (band >= 0) pixels.set(colors[band] ?? uncovered, cell * 4);
  });
  return pixels;
};

/**
 * What the map draws of a city's coverage: the city shaded by the distance to the nearest station,
 * and its outline.
 *
 * @param coverage - The city, cell by cell, at the moment shown.
 * @param boundary - The city's outline.
 * @returns The drawing.
 */
export const coverageDrawing = (coverage: CoverageCells, boundary: CityBoundary): NonNullable<CoverageDrawing> => ({
  image: { width: coverage.columns, height: coverage.rows, pixels: coverageImage(coverage) },
  corners: coverage.corners,
  outline: boundary.polygons.flat().map(ring => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } })),
});
