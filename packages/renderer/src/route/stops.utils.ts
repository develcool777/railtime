import type { RouteInfo } from '../transitMap.types';
import type { RouteStopKind, RouteStopMark } from './stops.types';

/** Which mark a stop keeps when two legs give it one: a change outranks a stop passed, the end both; of two alike, the later (at a change, the line boarded). */
const RANK: Record<RouteStopKind, number> = { pass: 0, board: 1, end: 2 };

/**
 * The stops a route marks on the map, once each: every stop a ride passes, a ring where each ride
 * begins or ends (its start, and every change, a walk's included), and the end.
 *
 * @param route - The route.
 * @returns Each stop with its mark, in the order the route reaches them.
 */
export const routeStopMarks = (route: RouteInfo): RouteStopMark[] => {
  const marks = new Map<string, RouteStopMark>();
  const mark = (station: string, name: string, kind: RouteStopKind, color: string) => {
    const known = marks.get(station);
    if (!known || RANK[kind] >= RANK[known.kind]) marks.set(station, { station, name, kind, color });
  };
  for (const leg of route.legs) {
    if (leg.kind !== 'ride') continue;
    // Where a ride begins or ends is a change, its start, or (marked below) its end.
    leg.stops.forEach((stop, place) => mark(stop.id, stop.name, place === 0 || place === leg.stops.length - 1 ? 'board' : 'pass', leg.color));
  }
  const lastRide = route.legs.findLast(leg => leg.kind === 'ride');
  mark(route.to.id, route.to.name, 'end', lastRide?.kind === 'ride' ? lastRide.color : '');
  return [...marks.values()];
};
