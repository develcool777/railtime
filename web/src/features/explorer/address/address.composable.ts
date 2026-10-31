import { useRoute, useRouter } from '#imports';
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';

import { formatExplorerQuery, sameQuery } from '~/features/explorer/address/address.utils';
import type { ExplorerUrlState } from '~/features/explorer/address/address.types';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { Section } from '~/features/explorer/explorer.types';
import { isDated } from '~/features/explorer/time/time.utils';

/**
 * The address follows what is looked at, so it can be shared: the day and the view, the tab, the line
 * or station open, 3D, the station names, map only. The store opened on what it said (`open`); from
 * then on it is written from the store. While playing the day is left as it was, not rewritten every change.
 *
 * @param opening - What the address said when the page opened.
 * @param openingSection - The section a page opens on without a tab in its address: left out of it.
 */
export const useExplorerAddress = (opening: ExplorerUrlState, openingSection: Section): void => {
  const { section, openStation, openLine, viewMode, stationNames, mapOnly, playing, time, view, plan } = storeToRefs(useExplorerStore());
  const route = useRoute();
  const router = useRouter();

  // The day the address says: followed while exploring, kept as it was while playing.
  const date = ref(opening.date);
  watch(time, now => {
    if (!playing.value) date.value = isDated(now, plan.value !== undefined) ? now.time : undefined;
  });
  const query = computed(() =>
    formatExplorerQuery({
      ...(date.value === undefined ? {} : { date: date.value }),
      ...(view.value ? { view: view.value } : {}),
      ...(openStation.value ? { station: openStation.value } : {}),
      ...(plan.value ? { plan: plan.value } : {}),
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
