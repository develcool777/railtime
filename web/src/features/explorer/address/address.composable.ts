import { useRoute, useRouter } from '#imports';
import { COVERAGE_DEFAULT_METRES } from '@railtime/network/coverage.constants';
import { storeToRefs } from 'pinia';
import { watchThrottled } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

import { ADDRESS_WRITE_MS } from '~/features/explorer/address/address.constants';
import { formatExplorerQuery, linkedPlayheadOf, sameQuery } from '~/features/explorer/address/address.utils';
import type { ExplorerUrlState, LinkedPlayhead } from '~/features/explorer/address/address.types';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import { useToolsStore } from '~/features/explorer/tools.store';
import { DEFAULT_PLAYER } from '~/features/explorer/time/time.constants';
import type { Section } from '~/features/explorer/explorer.types';

/**
 * The address follows what is looked at, so it can be shared: the playhead (`at`) and the view, the tab, the line
 * or station open, a route's ends and the way drawn, a reach's start, coverage's distance, 3D, the station and street names, map only, the panel folded, how playback is set. The store opened on what it said (`open`); from
 * then on it is written from the store, playing too, at most every `ADDRESS_WRITE_MS`: a reload or a link opens where the map is.
 *
 * @param opening - What the address said when the page opened.
 * @param openingSection - The section a page opens on without a tab in its address: left out of it.
 */
export const useExplorerAddress = (opening: ExplorerUrlState, openingSection: Section): void => {
  const { section, openStation, openLine, viewMode, stationNames, streetNames, mapOnly, panelOpen, player, time, view, pickedPlan, facts } =
    storeToRefs(useExplorerStore());
  const { routeEnds, routeOption, reachFrom, coverageMetres } = storeToRefs(useToolsStore());
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
      ...(routeEnds.value.from || routeEnds.value.to
        ? {
            route: {
              ...(routeEnds.value.from ? { from: routeEnds.value.from.id } : {}),
              ...(routeEnds.value.to ? { to: routeEnds.value.to.id } : {}),
              ...(routeOption.value > 0 ? { option: routeOption.value } : {}),
            },
          }
        : {}),
      ...(reachFrom.value ? { reach: reachFrom.value.id } : {}),
      ...(openLine.value ? { line: openLine.value } : {}),
      ...(viewMode.value === '3d' ? { viewMode: '3d' as const } : {}),
      ...(stationNames.value ? {} : { stationNames: false as const }),
      ...(streetNames.value ? {} : { streetNames: false as const }),
      ...(mapOnly.value ? { mapOnly: true as const } : {}),
      ...(panelOpen.value ? {} : { panelOpen: false as const }),
      ...(player.value.speed === DEFAULT_PLAYER.speed ? {} : { speed: player.value.speed }),
      ...(player.value.camera === DEFAULT_PLAYER.camera ? {} : { camera: player.value.camera }),
      ...(player.value.minimap ? {} : { minimap: false as const }),
    }),
  );
  // Written at once, then at most every ADDRESS_WRITE_MS, the last one always.
  watchThrottled(
    query,
    next => {
      if (!sameQuery(next, route.query)) void router.replace({ query: next });
    },
    { throttle: ADDRESS_WRITE_MS },
  );
};
