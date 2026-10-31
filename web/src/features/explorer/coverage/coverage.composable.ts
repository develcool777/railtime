import { useRuntimeConfig } from '#imports';
import type { CityBoundary } from '@railtime/schema/boundary.types';
import { computed, ref, shallowRef, watch } from 'vue';

import type { BoundaryState, Coverage, CoverageInput } from '~/features/explorer/coverage/coverage.composable.types';
import { boundaryUrlOf } from '~/utils/city.utils';

/**
 * How much of the city is within walking distance of a station: its outline loaded the first time the
 * Coverage section opens, the coverage found again for the date shown, and drawn on the map while the
 * section is open, playing too.
 *
 * @param input - The map, the panel's section, and the city.
 * @returns Where the outline is, the coverage, and its history.
 */
export const useCoverage = (input: CoverageInput): Coverage => {
  const { binding, section, city } = input;
  const { map, time } = binding;
  const baseURL = useRuntimeConfig().app.baseURL;

  const boundary = shallowRef<CityBoundary | null>(null);
  const boundaryState = ref<BoundaryState>('idle');
  const shown = computed(() => section.value === 'coverage');

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

  const coverage = computed(() => {
    const shownCursor = time.value?.cursor;
    return boundaryState.value === 'ready' && map.value && shownCursor !== undefined ? map.value.findCoverage() : null;
  });
  const history = computed(() => (boundaryState.value === 'ready' && map.value ? map.value.getCoverageHistory() : []));
  watch([shown, coverage], () => map.value?.showCoverage(shown.value && coverage.value !== null));

  return { boundaryState, coverage, history };
};
