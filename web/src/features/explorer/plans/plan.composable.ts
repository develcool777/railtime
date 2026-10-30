import { useColorMode } from '#imports';
import { isPlanOnly } from '@railtime/schema/plan.utils';
import { computed, ref, watch } from 'vue';

import { formatPlanFacts, formatStats } from '~/features/explorer/format.utils';
import type { ExplorerPlan, ExplorerPlanInput } from '~/features/explorer/plans/plan.composable.types';
import { planFacts } from '~/features/explorer/plans/plan.utils';

/**
 * The plan shown, if any, and what the page says about it: its summary, the legend for its dashed
 * track, and what is built today to compare it with.
 *
 * @param input - The network, the plan, and where the map is.
 * @returns The plan and its captions.
 */
export const useExplorerPlan = (input: ExplorerPlanInput): ExplorerPlan => {
  const { network, plan, time, timeMode } = input;
  const colorMode = useColorMode();

  const chosenPlan = computed(() => (plan ? network.plans?.[plan] : undefined));
  // What the plan adds, worked out once: it does not change.
  const chosenFacts = plan ? planFacts(network, plan) : null;

  const planSummary = computed(() =>
    chosenPlan.value && chosenFacts ? { name: chosenPlan.value.name, facts: formatPlanFacts(chosenFacts.stations, chosenFacts.km) } : undefined,
  );

  const planLegend = computed(() => {
    const firstLine = chosenFacts?.lines[0];
    if (!chosenPlan.value || !time.value?.future || timeMode.value === 'playing') return null;
    if (!firstLine) return { name: chosenPlan.value.name, color: 'var(--ui-text-highlighted)' };
    return { name: chosenPlan.value.name, color: colorMode.value === 'light' ? firstLine.color : firstLine.darkColor };
  });

  // Read once the map first shows today: with a plan shown it never does, and the card is not shown.
  const builtFacts = ref('');
  watch(time, now => {
    if (!builtFacts.value && !plan && now && now.cursor === now.todayCursor && !now.future) builtFacts.value = formatStats(now.stats);
  });

  return {
    planOnly: isPlanOnly(network),
    planCount: Object.keys(network.plans ?? {}).length,
    chosenPlan,
    planSummary,
    planLegend,
    builtFacts,
  };
};
