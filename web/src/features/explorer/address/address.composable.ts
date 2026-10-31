import { useRoute, useRouter } from '#imports';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import type { ExplorerAddressInput } from '~/features/explorer/address/address.composable.types';
import { formatExplorerQuery, sameQuery } from '~/features/explorer/address/address.utils';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import { isDated } from '~/features/explorer/time/time.utils';

/**
 * The address and the page, kept in step. The store opens on what the address says (the explorer
 * calls `open` with it); the map opens on its day, or a plan's future. Then the address follows what
 * is looked at, so it can be shared: the day and the view, the tab, the line or station open, 3D, the
 * station names, map only. While playing the day is left as it was, not rewritten every change.
 *
 * @param input - The plan, the map, the address at opening, and the section a page opens on.
 */
export const useExplorerAddress = (input: ExplorerAddressInput): void => {
  const { plan, binding, opening, openingSection } = input;
  const { map, time, view } = binding;
  const { section, openStation, openLine, viewMode, stationNames, mapOnly, playing } = storeToRefs(useExplorerStore());
  const route = useRoute();
  const router = useRouter();

  watch(map, transitMap => {
    if (!transitMap) return;
    const { start, end } = transitMap.range;
    if (opening.date !== undefined) transitMap.setDate(Math.min(Math.max(opening.date, start), end));
    // A plan opens on its future, built.
    else if (plan) transitMap.showFuture();
  });

  // The day the address says: followed while exploring, kept as it was while playing.
  const date = ref(opening.date);
  watch(time, now => {
    if (!playing.value) date.value = isDated(now, plan !== undefined) ? now.time : undefined;
  });
  const query = computed(() =>
    formatExplorerQuery({
      ...(date.value === undefined ? {} : { date: date.value }),
      ...(view.value ? { view: view.value } : {}),
      ...(openStation.value ? { station: openStation.value } : {}),
      ...(plan ? { plan } : {}),
      ...(section.value === openingSection ? {} : { section: section.value }),
      ...(openLine.value ? { line: openLine.value } : {}),
      ...(viewMode.value === '3d' ? { viewMode: '3d' as const } : {}),
      ...(stationNames.value ? {} : { stationNames: false as const }),
      ...(mapOnly.value ? { mapOnly: true as const } : {}),
    }),
  );
  watch(query, next => {
    if (!sameQuery(next, route.query)) void router.replace({ query: next });
  });
};
