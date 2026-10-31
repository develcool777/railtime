import { useRuntimeConfig } from '#imports';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { storeToRefs } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';

import type { BoundaryState, Coverage, CoverageInput } from '~/features/explorer/coverage/coverage.composable.types';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import { boundaryUrlOf } from '~/utils/city.utils';

/**
 * How much of the city is within walking distance of a station: its outline loaded the first time the
 * map is to draw it, and given to the map, which works the coverage out on each date it shows.
 *
 * @param input - The map, and the city.
 * @returns Where the outline is, the coverage, and its history.
 */
export const useCoverage = (input: CoverageInput): Coverage => {
  const { binding, city } = input;
  const { mapOverlay } = storeToRefs(useExplorerStore());
  const { map, overlay } = binding;
  const baseURL = useRuntimeConfig().app.baseURL;

  const boundary = shallowRef<CityBoundary | null>(null);
  const boundaryState = ref<BoundaryState>('idle');
  const shown = computed(() => mapOverlay.value === 'coverage');

  watch(
    shown,
    async open => {
      if (!open || boundaryState.value !== 'idle') return;
      boundaryState.value = 'loading';
      try {
        // The base URL is joined here, as for the network: see the city page.
        boundary.value = await $fetch<CityBoundary>(`${baseURL}${boundaryUrlOf(city)}`);
        boundaryState.value = 'ready';
      } catch {
        // Not every city has an outline yet.
        boundaryState.value = 'missing';
      }
    },
    { immediate: true },
  );

  // The map takes the outline once both are there, whichever comes first.
  watch([map, boundary], () => map.value?.setBoundary(boundary.value), { immediate: true });

  // Drawn as the store asks, and worked out again on each date by the map.
  const coverage = computed(() => (overlay.value?.kind === 'coverage' ? overlay.value.coverage : null));
  const history = computed(() => (boundaryState.value === 'ready' && map.value ? map.value.getCoverageHistory() : []));

  return { boundaryState, coverage, history };
};
