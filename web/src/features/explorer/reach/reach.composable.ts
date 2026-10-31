import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { ReachFinder } from '~/features/explorer/reach/reach.composable.types';

/**
 * How far one gets from the station the store has picked, as the map found it on the date shown, and
 * the dot Reach's icon wears while one is set.
 *
 * @returns The reach found, and what its dot says.
 */
export const useReachFinder = (): ReachFinder => {
  const { reachFrom, overlayResult: overlay } = storeToRefs(useExplorerStore());

  const foundReach = computed(() => (overlay.value?.kind === 'reach' ? overlay.value.reach : null));
  const reachMark = computed(() => (reachFrom.value ? `How far one gets from ${reachFrom.value.name} is set` : undefined));

  return { foundReach, reachMark };
};
