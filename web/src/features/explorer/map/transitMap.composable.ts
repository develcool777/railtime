import { TransitMap } from '@railtime/renderer/transitMap.service';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, watch } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import { useMapStore } from '~/features/explorer/map/map.store';
import { useTimeStore } from '~/features/explorer/time/time.store';
import { useToolsStore } from '~/features/explorer/tools.store';
import type { TransitMapMount } from '~/features/explorer/map/transitMap.composable.types';

/**
 * Makes the map and takes it down: an effect, and nothing else. On mount it makes the map with the
 * explorer's `mapProps`, where the map store says it looks, and listeners that call the stores'
 * actions with what it says; it hands the map to the explorer (`ATTACH`), gives it each change of
 * `mapProps`, and takes it down on unmount. Commands reach the map through the stores' actions only.
 * Client only: call it inside `<ClientOnly>`.
 *
 * @param mount - Where the map and the minimap go.
 */
export const useTransitMap = (mount: TransitMapMount): void => {
  const explorer = useExplorerStore();
  const mapStore = useMapStore();
  const timeStore = useTimeStore();
  const tools = useToolsStore();
  let map: TransitMap | null = null;

  onMounted(() => {
    const props = explorer.mapProps;
    if (!props) return;
    map = new TransitMap({
      container: mount.container.value!,
      minimapContainer: mount.minimapContainer.value ?? undefined,
      props,
      ...(mapStore.view ? { view: mapStore.view } : {}),
      // The page shows the credits itself, in a corner of the map.
      attributionControl: false,
      workerUrl,
      on: {
        time: time => timeStore.SET_TIME(time),
        step: step => timeStore.SET_STEP(step),
        overlay: result => tools.SET_OVERLAY_RESULT(result),
        view: view => mapStore.SET_VIEW(view),
        stationClick: id => explorer.CLICK_STATION(id),
        // The station open left the map on another date: its view closes.
        selectionGone: () => explorer.CLOSE_STATION(),
        end: () => timeStore.PLAYBACK_ENDED(),
      },
    });
    explorer.ATTACH(map);
  });

  // Another plan's network is one of them: drawn on the same map.
  watch(
    () => explorer.mapProps,
    props => props && map?.update(props),
  );

  onBeforeUnmount(() => {
    mapStore.DETACH();
    map?.destroy();
    map = null;
  });
};
