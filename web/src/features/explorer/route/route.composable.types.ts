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
  /** Opens a section in the panel, for a route started from a station. */
  openSection: (id: Section) => void;
};

/** A route between two stations, on the date shown. */
export type RouteFinder = {
  /** Where it starts and ends, once picked. */
  routeEnds: Ref<{ from: RouteStop | null; to: RouteStop | null }>;
  routePreference: Ref<RoutePreference>;
  /** The route between the two, on the date shown; `null` until both are picked, or with none. */
  foundRoute: ComputedRef<RouteInfo | null>;
  /** Whether it is drawn on the map: while Route is open, but for playback. */
  routeShown: ComputedRef<boolean>;
  /** Starts or ends the route at the station whose view is open, and opens Route. */
  routeFromStation: (end: 'from' | 'to') => void;
  /** Swaps where it starts and ends. */
  swapEnds: () => void;
};
