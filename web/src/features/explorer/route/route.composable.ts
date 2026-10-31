import type { RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';

import type { RouteFinder, RouteFinderInput } from '~/features/explorer/route/route.composable.types';

/**
 * A route between two stations, found again for the date shown (lines open and close), and drawn on
 * the map while the store says so: in the Route section, but not while playing.
 *
 * @param input - The map.
 * @returns The route's ends, the route found, and what changes them.
 */
export const useRouteFinder = (input: RouteFinderInput): RouteFinder => {
  const { binding } = input;
  const { map, time } = binding;
  const { mapOverlay } = storeToRefs(useExplorerStore());

  const routeEnds = ref<{ from: RouteStop | null; to: RouteStop | null }>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const foundRoute = computed(() => {
    const { from, to } = routeEnds.value;
    const shown = time.value?.cursor;
    return from && to && map.value && shown !== undefined ? map.value.findRoute(from.id, to.id, routePreference.value) : null;
  });
  const routeShown = computed(() => mapOverlay.value === 'route');
  watch([foundRoute, routeShown], () => map.value?.showRoute(routeShown.value ? foundRoute.value : null));

  const swapEnds = () => (routeEnds.value = { from: routeEnds.value.to, to: routeEnds.value.from });

  const routeMark = computed(() => (foundRoute.value ? `A route from ${foundRoute.value.from.name} to ${foundRoute.value.to.name} is set` : undefined));

  return { routeEnds, routePreference, foundRoute, swapEnds, routeMark };
};
