import type { RouteInfo, Stop } from '@railtime/network/facts.types';

/** What the map draws over the network for the panel's section: a route, a reach, or the city's coverage. */
export type MapOverlay = 'route' | 'reach' | 'coverage';

/** A route's ends, once picked. */
export type RouteEnds = { from: Stop | null; to: Stop | null };

/** What a station clicked on the map does: opens, or is picked as a route's ends or a reach's start. */
export type StationPick = { kind: 'open' } | { kind: 'route'; ends: RouteEnds } | { kind: 'reach'; from: Stop };

/** Where the city's outline is: not asked for yet, coming, here, or there is none. */
export type BoundaryState = 'idle' | 'loading' | 'ready' | 'missing';

/** The ways between a route's ends the map found, fastest first, and the one it draws. */
export type FoundRoutes = { routes: RouteInfo[]; shown: number | null };
