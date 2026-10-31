import type { RouteStop } from '@railtime/renderer/transitMap.types';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';

import type { ReachFinder, ReachFinderInput } from '~/features/explorer/reach/reach.composable.types';

/**
 * How far one gets from a station, found again for the date shown (lines open and close), and drawn
 * on the map while the store says so: in the Reach section, but not while playing.
 *
 * @param input - The map.
 * @returns The station it starts at, the reach found, and what its dot on the rail says.
 */
export const useReachFinder = (input: ReachFinderInput): ReachFinder => {
  const { binding } = input;
  const { map, time } = binding;
  const { mapOverlay } = storeToRefs(useExplorerStore());

  const reachFrom = ref<RouteStop | null>(null);
  const foundReach = computed(() => {
    const shown = time.value?.cursor;
    return reachFrom.value && map.value && shown !== undefined ? map.value.findReach(reachFrom.value.id) : null;
  });
  const reachShown = computed(() => mapOverlay.value === 'reach');
  watch([foundReach, reachShown], () => map.value?.showReach(reachShown.value ? foundReach.value : null));

  const reachMark = computed(() => (foundReach.value ? `How far one gets from ${foundReach.value.from.name} is set` : undefined));

  return { reachFrom, foundReach, reachMark };
};
