import type { ReachInfo, RouteStop } from '@railtime/renderer/transitMap.types';
import type { ComputedRef, Ref } from 'vue';

import type { Section, TimeMode } from '~/features/explorer/explorer.types';
import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useReachFinder` reads. */
export type ReachFinderInput = {
  binding: TransitMapBinding;
  /** The panel's open section: the reach is drawn while it is Reach. */
  section: Ref<Section>;
  timeMode: Ref<TimeMode>;
};

/** How far one gets from a station, on the date shown. */
export type ReachFinder = {
  /** The station it starts at, once picked. */
  reachFrom: Ref<RouteStop | null>;
  /** Every station reached from it on the date shown; `null` until one is picked, or when no line calls there. */
  foundReach: ComputedRef<ReachInfo | null>;
  /** What the dot on Reach says while a reach is set, whatever section is open; none without one. */
  reachMark: ComputedRef<string | undefined>;
};
