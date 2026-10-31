import type { ComputedRef } from 'vue';

/** What `useExplorerPlan` takes. */
export type ExplorerPlanInput = {
  /** Shows another plan, or the built network (`undefined`): the page mounts the explorer afresh, on Plans. */
  onChoose: (plan: string | undefined) => void;
};

/** What the page says about the plan shown. */
export type ExplorerPlan = {
  /** Its name and what it adds, for the time control. */
  planSummary: ComputedRef<{ name: string; facts: string } | undefined>;
  /** The legend for its dashed track, while the map shows its future: its first line's colour, as CSS. */
  planLegend: ComputedRef<{ name: string; color: string } | null>;
  /** What is built today, for the Plans section's first card. */
  builtFacts: ComputedRef<string>;
  /** What the dot on Plans says while a plan is shown, whatever section is open; none without one. */
  planMark: string | undefined;
  /** Chooses a plan, or the built network; the one shown already does nothing. */
  choosePlan: (plan: string | undefined) => void;
};
