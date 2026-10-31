import type { TimeState } from '@railtime/renderer/transitMap.types';
import type { Network, Plan } from '@railtime/schema/network.types';
import type { ComputedRef, Ref } from 'vue';

/** What `useExplorerPlan` reads. */
export type ExplorerPlanInput = {
  network: Network;
  /** The plan shown, if any. */
  plan?: string;
  time: Ref<TimeState | null>;
  /** Shows another plan, or the built network (`undefined`): the page mounts the explorer afresh, on Plans. */
  onChoose: (plan: string | undefined) => void;
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
  /** What the dot on Plans says while a plan is shown, whatever section is open; none without one. */
  planMark: string | undefined;
  /** Chooses a plan, or the built network; the one shown already does nothing. */
  choosePlan: (plan: string | undefined) => void;
};
