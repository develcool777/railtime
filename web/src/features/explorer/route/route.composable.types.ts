import type { RouteInfo, RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
import type { ComputedRef, Ref } from 'vue';

import type { Section, TimeMode } from '~/features/explorer/explorer.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useRouteFinder` reads. */
export type RouteFinderInput = {
  binding: TransitMapBinding;
  /** The panel's open section: the route is drawn while it is Route. */
  section: Ref<Section>;
  timeMode: Ref<TimeMode>;
};

/** A route between two stations, on the date shown. */
export type RouteFinder = {
  /** Where it starts and ends, once picked. */
  routeEnds: Ref<{ from: RouteStop | null; to: RouteStop | null }>;
  routePreference: Ref<RoutePreference>;
  /** The route between the two, on the date shown; `null` until both are picked, or with none. */
  foundRoute: ComputedRef<RouteInfo | null>;
  /** Swaps where it starts and ends. */
  swapEnds: () => void;
  /** What the dot on Route says while a route is set, whatever section is open; none without one. */
  routeMark: ComputedRef<string | undefined>;
};
