import { useRoute, useRouter } from '#imports';
import { computed, watch } from 'vue';

import type { ExplorerAddressInput } from '~/features/explorer/address/address.composable.types';
import { formatExplorerQuery } from '~/features/explorer/address/address.utils';
import { isDated } from '~/features/explorer/time/time.utils';

/**
 * The address and the map, kept in step: the map opens where the address points (a day, a plan's
 * future, a station's view), then, while exploring, the address follows the map so it can be
 * shared. Playback leaves it alone.
 *
 * @param input - The network and plan, the map, what the time control shows, and the address at opening.
 */
export const useExplorerAddress = (input: ExplorerAddressInput): void => {
  const { network, plan, chosenPlan, binding, timeMode, opening } = input;
  const { map, time, station, view } = binding;
  const route = useRoute();
  const router = useRouter();

  watch(map, transitMap => {
    if (!transitMap) return;
    const { start, end } = transitMap.range;
    if (opening.date !== undefined) transitMap.setDate(Math.min(Math.max(opening.date, start), end));
    // A plan opens on its future, built.
    else if (plan) transitMap.showFuture();
    // A station the network does not have is a stale link: open without it.
    if (opening.station && (network.stations[opening.station] || chosenPlan.value?.stations?.[opening.station])) {
      station.value = transitMap.getStationInfo(opening.station);
      transitMap.selectStation(opening.station);
    }
  });

  const query = computed(() => {
    const now = time.value;
    return formatExplorerQuery({
      ...(isDated(now, plan !== undefined) ? { date: now.time } : {}),
      ...(view.value ? { view: view.value } : {}),
      ...(station.value ? { station: station.value.id } : {}),
      ...(plan ? { plan } : {}),
    });
  });
  watch(query, next => {
    if (timeMode.value === 'playing') return;
    if (JSON.stringify(next) !== JSON.stringify(route.query)) void router.replace({ query: next });
  });
};
