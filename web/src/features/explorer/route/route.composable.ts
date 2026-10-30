import type { RoutePreference, RouteStop } from '@railtime/renderer/transitMap.types';
import { computed, ref, watch } from 'vue';

import type { RouteFinder, RouteFinderInput } from '~/features/explorer/route/route.composable.types';

/**
 * A route between two stations, found again for the date shown (lines open and close), and drawn on
 * the map while the Route section is open.
 *
 * @param input - The map, the panel's section, and what the time control shows.
 * @returns The route's ends, the route found, and what changes them.
 */
export const useRouteFinder = (input: RouteFinderInput): RouteFinder => {
  const { binding, section, timeMode } = input;
  const { map, time } = binding;

  const routeEnds = ref<{ from: RouteStop | null; to: RouteStop | null }>({ from: null, to: null });
  const routePreference = ref<RoutePreference>('fastest');
  const foundRoute = computed(() => {
    const { from, to } = routeEnds.value;
    const shown = time.value?.cursor;
    return from && to && map.value && shown !== undefined ? map.value.findRoute(from.id, to.id, routePreference.value) : null;
  });
  const routeShown = computed(() => section.value === 'route' && timeMode.value !== 'playing');
  watch([foundRoute, routeShown], () => map.value?.showRoute(routeShown.value ? foundRoute.value : null));

  const swapEnds = () => (routeEnds.value = { from: routeEnds.value.to, to: routeEnds.value.from });

  return { routeEnds, routePreference, foundRoute, swapEnds };
};
