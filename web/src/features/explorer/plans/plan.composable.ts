import { planFacts } from '@railtime/network/plan.utils';
import { isPlanOnly } from '@railtime/schema/plan.utils';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { formatPlanFacts, formatStats } from '~/features/explorer/format.utils';
import type { ExplorerPlan, ExplorerPlanInput } from '~/features/explorer/plans/plan.composable.types';

/**
 * The plan shown, if any, and what the page says about it: its summary, the legend for its dashed
 * track, what is built today to compare it with, and choosing another.
 *
 * @param input - The network, the plan, and what choosing one does.
 * @returns The plan and its captions.
 */
export const useExplorerPlan = (input: ExplorerPlanInput): ExplorerPlan => {
  const { network, plan, onChoose } = input;
  const { playing, time, theme, model } = storeToRefs(useExplorerStore());

  const chosenPlan = computed(() => (plan ? network.plans?.[plan] : undefined));
  // What the plan adds, worked out once: it does not change.
  const chosenFacts = plan ? planFacts(network, plan) : null;

  const planSummary = computed(() =>
    chosenPlan.value && chosenFacts ? { name: chosenPlan.value.name, facts: formatPlanFacts(chosenFacts.stations, chosenFacts.km) } : undefined,
  );

  const planLegend = computed(() => {
    const firstLine = chosenFacts?.lines[0];
    if (!chosenPlan.value || !time.value?.future || playing.value) return null;
    if (!firstLine) return { name: chosenPlan.value.name, color: 'var(--ui-text-highlighted)' };
    return { name: chosenPlan.value.name, color: theme.value === 'light' ? firstLine.color : firstLine.darkColor };
  });

  // The network built today, to set beside a plan; with a plan shown the model is the plan's, and the card goes without.
  const builtFacts = computed(() => {
    const built = model.value;
    return built && !plan ? formatStats(built.asOf(built.momentOn(built.range.today), theme.value).stats()) : '';
  });

  const choosePlan = (id: string | undefined) => {
    if (id !== plan) onChoose(id);
  };

  return {
    planOnly: isPlanOnly(network),
    planCount: Object.keys(network.plans ?? {}).length,
    chosenPlan,
    planSummary,
    planLegend,
    builtFacts,
    planMark: plan ? 'A plan is shown' : undefined,
    choosePlan,
  };
};
