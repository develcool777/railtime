import { useColorMode } from '#imports';
import { isPlanOnly } from '@railtime/schema/plan.utils';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { formatPlanFacts, formatStats } from '~/features/explorer/format.utils';
import type { ExplorerPlan, ExplorerPlanInput } from '~/features/explorer/plans/plan.composable.types';
import { planFacts } from '~/features/explorer/plans/plan.utils';

/**
 * The plan shown, if any, and what the page says about it: its summary, the legend for its dashed
 * track, what is built today to compare it with, and choosing another.
 *
 * @param input - The network, the plan, where the map is, and what choosing one does.
 * @returns The plan and its captions.
 */
export const useExplorerPlan = (input: ExplorerPlanInput): ExplorerPlan => {
  const { network, plan, time, onChoose } = input;
  const { playing } = storeToRefs(useExplorerStore());
  const colorMode = useColorMode();

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
    return { name: chosenPlan.value.name, color: colorMode.value === 'light' ? firstLine.color : firstLine.darkColor };
  });

  // Read once the map first shows today, drawn: before its first frame its stats are all nought. With a plan shown it never shows today, and the card goes without.
  const builtFacts = ref('');
  watch(time, now => {
    const drawnToday = now && now.cursor === now.todayCursor && !now.future && now.stats.stations > 0;
    if (!builtFacts.value && !plan && drawnToday) builtFacts.value = formatStats(now.stats);
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
