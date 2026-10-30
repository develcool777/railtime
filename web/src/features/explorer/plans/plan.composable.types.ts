import type { TimeState } from '@railtime/renderer/transitMap.types';
import type { Network, Plan } from '@railtime/schema/network.types';
import type { ComputedRef, Ref } from 'vue';

import type { TimeMode } from '~/features/explorer/explorer.types';

/** What `useExplorerPlan` reads. */
export type ExplorerPlanInput = {
  network: Network;
  /** The plan shown, if any. */
  plan?: string;
  time: Ref<TimeState | null>;
  timeMode: Ref<TimeMode>;
};

/** The plan shown, and what the page says about it. */
export type ExplorerPlan = {
  /** The network was never built: it has only plans. */
  planOnly: boolean;
  /** How many plans the city has. */
  planCount: number;
  chosenPlan: ComputedRef<Plan | undefined>;
  /** Its name and what it adds, for the time control. */
  planSummary: ComputedRef<{ name: string; facts: string } | undefined>;
  /** The legend for its dashed track, while the map shows its future. */
  planLegend: ComputedRef<{ name: string; color: string } | null>;
  /** What is built today, for the Plans section's first card. */
  builtFacts: Ref<string>;
};
