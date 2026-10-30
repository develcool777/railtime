import type { NetworkGrowth, NetworkRecords } from '@railtime/renderer/transitMap.types';
import type { ComputedRef } from 'vue';

import type { TransitMapBinding } from '~/features/explorer/map/transitMap.composable.types';

/** What `useInsights` reads. */
export type InsightsInput = { binding: TransitMapBinding };

/** How the network grew, and its records on the date shown. */
export type Insights = {
  /** The network year by year, and the stations each decade opened; `null` until the map is mounted. */
  growth: ComputedRef<NetworkGrowth | null>;
  /** Its records on the date shown; `null` until the map is mounted. */
  records: ComputedRef<NetworkRecords | null>;
  /** The year shown on the map; `null` in a plan's future. */
  shownYear: ComputedRef<number | null>;
};
