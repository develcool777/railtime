import type { ReachInfo } from '@railtime/network/facts.types';
import type { ComputedRef } from 'vue';

/** How far one gets from a station, on the date shown. */
export type ReachFinder = {
  /** Every station reached from it on the date shown; `null` until one is picked, while it is not drawn, or when no line calls there. */
  foundReach: ComputedRef<ReachInfo | null>;
  /** What the dot on Reach says while a reach is set, whatever section is open; none without one. */
  reachMark: ComputedRef<string | undefined>;
};
