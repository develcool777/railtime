import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { formatPlanFacts, formatStats, lineColor } from '~/features/explorer/format.utils';
import type { ExplorerPlan, ExplorerPlanInput } from '~/features/explorer/plans/plan.composable.types';

/**
 * The plan shown, if any, and what the page says about it: its summary, the legend for its dashed
 * track, what is built today to compare it with, and choosing another. Every fact is the network's,
 * from the store.
 *
 * @param input - What choosing a plan does.
 * @returns The plan's captions.
 */
export const useExplorerPlan = (input: ExplorerPlanInput): ExplorerPlan => {
  const { playing, time, facts, plan, plans } = storeToRefs(useExplorerStore());

  const chosen = computed(() => plans.value.find(entry => entry.id === plan.value));

  const planSummary = computed(() =>
    chosen.value ? { name: chosen.value.name, facts: formatPlanFacts(chosen.value.facts.stations, chosen.value.facts.km) } : undefined,
  );

  const planLegend = computed(() => {
    if (!chosen.value || !time.value?.future || playing.value) return null;
    const firstLine = chosen.value.facts.lines[0];
    return { name: chosen.value.name, color: firstLine ? lineColor(firstLine.color) : 'var(--ui-text-highlighted)' };
  });

  // The network built today, to set beside a plan; with a plan shown the facts are the plan's, and the card goes without.
  const builtFacts = computed(() => (facts.value && !plan.value ? formatStats(facts.value.today().stats()) : ''));

  const choosePlan = (id: string | undefined) => {
    if (id !== plan.value) input.onChoose(id);
  };

  return {
    planSummary,
    planLegend,
    builtFacts,
    planMark: plan.value ? 'A plan is shown' : undefined,
    choosePlan,
  };
};
