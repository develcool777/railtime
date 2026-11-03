import type { Stop } from '@railtime/network/facts.types';

/** What the map draws over the network for the panel's section: a route, a reach, or the city's coverage. */
export type MapOverlay = 'route' | 'reach' | 'coverage';

/** A route's ends, once picked. */
export type RouteEnds = { from: Stop | null; to: Stop | null };

/** What a station clicked on the map does: opens, or is picked as a route's ends or a reach's start. */
export type StationPick = { kind: 'open' } | { kind: 'route'; ends: RouteEnds } | { kind: 'reach'; from: Stop };
