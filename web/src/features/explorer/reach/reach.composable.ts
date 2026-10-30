import type { RouteStop } from '@railtime/renderer/transitMap.types';
import { computed, ref, watch } from 'vue';

import type { ReachFinder, ReachFinderInput } from '~/features/explorer/reach/reach.composable.types';

/**
 * How far one gets from a station, found again for the date shown (lines open and close), and drawn
 * on the map while the Reach section is open.
 *
 * @param input - The map, the panel's section, and what the time control shows.
 * @returns The station it starts at, the reach found, and what its dot on the rail says.
 */
export const useReachFinder = (input: ReachFinderInput): ReachFinder => {
  const { binding, section, timeMode } = input;
  const { map, time } = binding;

  const reachFrom = ref<RouteStop | null>(null);
  const foundReach = computed(() => {
    const shown = time.value?.cursor;
    return reachFrom.value && map.value && shown !== undefined ? map.value.findReach(reachFrom.value.id) : null;
  });
  const reachShown = computed(() => section.value === 'reach' && timeMode.value !== 'playing');
  watch([foundReach, reachShown], () => map.value?.showReach(reachShown.value ? foundReach.value : null));

  const reachMark = computed(() => (foundReach.value ? `How far one gets from ${foundReach.value.from.name} is set` : undefined));

  return { reachFrom, foundReach, reachMark };
};
