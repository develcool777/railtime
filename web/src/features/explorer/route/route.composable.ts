import { storeToRefs } from 'pinia';
import { computed } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { RouteFinder } from '~/features/explorer/route/route.composable.types';

/**
 * The route between the two stations the store has picked, as the map found it on the date shown, and
 * the dot Route's icon wears while one is set.
 *
 * @returns The route found, and what its dot says.
 */
export const useRouteFinder = (): RouteFinder => {
  const { routeEnds, overlayResult: overlay } = storeToRefs(useExplorerStore());

  const foundRoute = computed(() => (overlay.value?.kind === 'route' ? overlay.value.route : null));
  const routeMark = computed(() => {
    const { from, to } = routeEnds.value;
    return from && to ? `A route from ${from.name} to ${to.name} is set` : undefined;
  });

  return { foundRoute, routeMark };
};
