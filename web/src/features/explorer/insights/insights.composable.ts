import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { Insights } from '~/features/explorer/insights/insights.composable.types';

/**
 * How the network grew, and its records at the moment the map shows: the network's facts asked, as
 * the date and the theme change.
 *
 * @returns The growth, the records and the year shown.
 */
export const useInsights = (): Insights => {
  const { facts, time } = storeToRefs(useExplorerStore());

  // The network's facts work the years out once.
  const growth = computed(() => facts.value?.growth() ?? null);
  const hasHistory = computed(() => facts.value?.hasHistory() ?? false);
  const records = computed(() => (facts.value && time.value ? facts.value.asOf(time.value).records(5) : null));
  // A plan's future has no year.
  const shownYear = computed(() => (time.value && !time.value.future ? new Date(time.value.time).getUTCFullYear() : null));

  return { growth, hasHistory, records, shownYear };
};
