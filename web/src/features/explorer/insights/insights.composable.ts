import { computed } from 'vue';

import type { Insights, InsightsInput } from '~/features/explorer/insights/insights.composable.types';

/**
 * How the network grew, year by year, and its records on the date shown. Both are read only while
 * the Insights section reads them.
 *
 * @param input - The map.
 * @returns The growth and the records.
 */
export const useInsights = (input: InsightsInput): Insights => {
  const { map, time } = input.binding;

  // The renderer works the years out once.
  const growth = computed(() => map.value?.getGrowth() ?? null);
  const records = computed(() => {
    const shown = time.value?.cursor;
    return map.value && shown !== undefined ? map.value.getRecords() : null;
  });
  // A plan's future has no year.
  const shownYear = computed(() => (time.value && !time.value.future ? new Date(time.value.time).getUTCFullYear() : null));

  return { growth, records, shownYear };
};
