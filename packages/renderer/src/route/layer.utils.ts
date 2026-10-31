import { required } from '@railtime/network/required.utils';
import type { PointFeature, RouteFeature, RouteStopProperties } from '../layers/features.types';
import { pointFeature } from '../layers/features.utils';
import type { NetworkIndex } from '@railtime/network/index.service';
import type { RouteInfo } from '@railtime/network/facts.types';
import { routeStopMarks } from './stops.utils';

/**
 * A route's track: each ride along its segments in its line's colour, each walk straight from one
 * station to the other.
 *
 * @param index - The network.
 * @param route - The route, or `null`.
 * @returns Its stretches; none without a route.
 */
export const routeTrack = (index: NetworkIndex, route: RouteInfo | null): RouteFeature[] =>
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
      properties: { color: leg.color, walk: false },
      geometry: { type: 'LineString', coordinates: required(index.segments[segment], `segment ${segment}`).coordinates },
    }));
  });

/**
 * A route's stops, marked where they are.
 *
 * @param index - The network.
 * @param route - The route, or `null`.
 * @returns Its stops; none without a route.
 */
export const routeStops = (index: NetworkIndex, route: RouteInfo | null): PointFeature<RouteStopProperties>[] =>
  route ? routeStopMarks(route).map(mark => pointFeature(index.coordOf(mark.station), { kind: mark.kind, color: mark.color, name: mark.name })) : [];
