import type { NetworkGrowth, NetworkRecords } from '@railtime/network/facts.types';
import type { ComputedRef } from 'vue';

/** How the network grew, and its records on the date shown. */
export type Insights = {
  /** The network year by year, and the stations each decade opened. */
  growth: ComputedRef<NetworkGrowth | null>;
  /** Whether some year has a station on the map: one never built has only its plans. */
  hasHistory: ComputedRef<boolean>;
  /** Its records on the date shown. */
  records: ComputedRef<NetworkRecords | null>;
  /** The year shown on the map; `null` in a plan's future. */
  shownYear: ComputedRef<number | null>;
};
