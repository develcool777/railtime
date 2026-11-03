import { useRoute, useRouter } from '#imports';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import { storeToRefs } from 'pinia';
import { computed, onScopeDispose, ref, watch } from 'vue';

import { ADDRESS_WRITE_MS } from '~/features/explorer/address/address.constants';
import { formatExplorerQuery, linkedPlayheadOf, sameQuery } from '~/features/explorer/address/address.utils';
import type { ExplorerUrlState, LinkedPlayhead } from '~/features/explorer/address/address.types';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { Section } from '~/features/explorer/explorer.types';

/**
 * The address follows what is looked at, so it can be shared: the playhead (`at`) and the view, the tab, the line
 * or station open, coverage's distance, 3D, the station names, map only. The store opened on what it said (`open`); from
 * then on it is written from the store, playing too, at most every `ADDRESS_WRITE_MS`: a reload or a link opens where the map is.
 *
 * @param opening - What the address said when the page opened.
 * @param openingSection - The section a page opens on without a tab in its address: left out of it.
 */
export const useExplorerAddress = (opening: ExplorerUrlState, openingSection: Section): void => {
  const { section, openStation, openLine, viewMode, stationNames, streetNames, mapOnly, time, view, pickedPlan, coverageMetres, facts } =
    storeToRefs(useExplorerStore());
  const route = useRoute();
  const router = useRouter();

  // The playhead the address names: as the address opened, until the map tells it where it is.
  const linked = ref<LinkedPlayhead | null>(opening.at ?? null);
  watch(time, now => {
    if (now && facts.value) linked.value = linkedPlayheadOf(now, facts.value.playheads);
  });
  const query = computed(() =>
    formatExplorerQuery({
      ...(linked.value ? { at: linked.value } : {}),
      ...(view.value ? { view: view.value } : {}),
      ...(openStation.value ? { station: openStation.value } : {}),
      ...(pickedPlan.value ? { plan: pickedPlan.value } : {}),
      ...(section.value === openingSection ? {} : { section: section.value }),
      ...(coverageMetres.value === COVERAGE_DEFAULT_METRES ? {} : { walk: coverageMetres.value }),
      ...(openLine.value ? { line: openLine.value } : {}),
      ...(viewMode.value === '3d' ? { viewMode: '3d' as const } : {}),
      ...(stationNames.value ? {} : { stationNames: false as const }),
      ...(streetNames.value ? {} : { streetNames: false as const }),
      ...(mapOnly.value ? { mapOnly: true as const } : {}),
    }),
  );
  // Written at once, then at most every ADDRESS_WRITE_MS, the last one always.
  let lastWrite = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const write = () => {
    pending = undefined;
    lastWrite = Date.now();
    if (!sameQuery(query.value, route.query)) void router.replace({ query: query.value });
  };
  watch(query, () => {
    if (pending) return;
    const wait = lastWrite + ADDRESS_WRITE_MS - Date.now();
    if (wait <= 0) write();
    else pending = setTimeout(write, wait);
  });
  onScopeDispose(() => clearTimeout(pending));
};
