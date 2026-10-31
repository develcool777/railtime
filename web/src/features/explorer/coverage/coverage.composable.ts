import { useRuntimeConfig } from '#imports';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { storeToRefs } from 'pinia';
import { computed, markRaw, ref, watch } from 'vue';

import type { BoundaryState, Coverage } from '~/features/explorer/coverage/coverage.composable.types';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import { boundaryUrlOf } from '~/utils/city.utils';

/**
 * How much of the city is within walking distance of a station: its outline loaded the first time the
 * map is to draw it, and kept in the store, whose props give it to the map. What it comes to on the
 * date shown is what the map reports; its history, the network's facts'.
 *
 * @param city - The city, whose outline is loaded.
 * @returns Where the outline is, the coverage, and its history.
 */
export const useCoverage = (city: string): Coverage => {
  const { mapOverlay, overlayResult, boundary, facts } = storeToRefs(useExplorerStore());
  const baseURL = useRuntimeConfig().app.baseURL;

  const boundaryState = ref<BoundaryState>('idle');
  const shown = computed(() => mapOverlay.value === 'coverage');

  watch(
    shown,
    async open => {
      if (!open || boundaryState.value !== 'idle') return;
      boundaryState.value = 'loading';
      try {
        // The base URL is joined here, as for the network: see the city page.
        boundary.value = markRaw(await $fetch<CityBoundary>(`${baseURL}${boundaryUrlOf(city)}`));
        boundaryState.value = 'ready';
      } catch {
        // Not every city has an outline yet.
        boundaryState.value = 'missing';
      }
    },
    { immediate: true },
  );

  const coverage = computed(() => (overlayResult.value?.kind === 'coverage' ? overlayResult.value.coverage : null));
  const history = computed(() => (boundary.value && facts.value ? facts.value.coverage(boundary.value).history() : []));

  return { boundaryState, coverage, history };
};
