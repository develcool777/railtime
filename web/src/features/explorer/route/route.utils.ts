import type { RouteInfo, RouteLegInfo, RouteStrength } from '@railtime/network/facts.types';

import { ROUTE_STRENGTHS } from '~/features/explorer/route/route.constants';
import { counted } from '~/utils/format.utils';

/** A ride, one leg of a route. */
type Ride = Extract<RouteLegInfo, { kind: 'ride' }>;

/**
 * A route, in a line: its stops, its changes and how far it rides.
 *
 * @param route - The route.
 * @returns "8 stops · 1 change · 12 km".
 */
export const routeSummary = (route: RouteInfo): string => {
  const stops = route.legs.reduce((total, leg) => total + (leg.kind === 'ride' ? leg.stops.length - 1 : 0), 0);
  const changes = route.changes === 0 ? 'no change' : counted(route.changes, 'change');
  return `${counted(stops, 'stop')} · ${changes} · ${Math.round(route.km)} km`;
};

/**
 * Where a way changes line, as its card says it: the station each ride after the first is boarded at.
 * The lines are its bar's colours, and the steps name them.
 *
 * @param route - The way.
 * @returns "via Petra Radzinia", "via Lukianivska, Zoloti Vorota", or "Direct".
 */
export const routeVia = (route: RouteInfo): string => {
  const boarded = route.legs.filter((leg): leg is Ride => leg.kind === 'ride').slice(1);
  return boarded.length > 0 ? `via ${boarded.map(ride => ride.stops[0]?.name).join(', ')}` : 'Direct';
};

/**
 * How a way compares with the fastest: what it takes more or less, and how many more or fewer changes.
 *
 * @param route - The way.
 * @param fastest - The fastest way.
 * @returns "+8 min · 2 more changes", "+3 min · 1 fewer change"; empty for the same.
 */
export const routeDifference = (route: RouteInfo, fastest: RouteInfo): string => {
  const minutes = Math.round(route.minutes) - Math.round(fastest.minutes);
  const changes = route.changes - fastest.changes;
  const changeWord = (count: number) => (count === 1 ? 'change' : 'changes');
  return [
    ...(minutes === 0 ? [] : [`${minutes > 0 ? '+' : '−'}${Math.abs(minutes)} min`]),
    ...(changes === 0 ? [] : [`${Math.abs(changes)} ${changes > 0 ? 'more' : 'fewer'} ${changeWord(Math.abs(changes))}`]),
  ].join(' · ');
};

/**
 * What a way is best at, as its card's badges say it.
 *
 * @param route - The way.
 * @returns Each strength's label and colour; none for a way best at neither.
 */
export const routeStrengths = (route: RouteInfo): (typeof ROUTE_STRENGTHS)[RouteStrength][] => route.best.map(strength => ROUTE_STRENGTHS[strength]);

/**
 * A ride, in a line.
 *
 * @param ride - The ride.
 * @returns "2 stops · 4 min".
 */
export const rideSummary = (ride: Ride): string => `${counted(ride.stops.length - 1, 'stop')} · ${Math.round(ride.minutes)} min`;
