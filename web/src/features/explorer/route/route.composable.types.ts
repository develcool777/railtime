import type { RouteInfo } from '@railtime/network/facts.types';
import type { ComputedRef } from 'vue';

/** A route between two stations, on the date shown. */
export type RouteFinder = {
  /** The route between the two, on the date shown; `null` until both are picked, while it is not drawn, or with none. */
  foundRoute: ComputedRef<RouteInfo | null>;
  /** What the dot on Route says while a route is set, whatever section is open; none without one. */
  routeMark: ComputedRef<string | undefined>;
};
