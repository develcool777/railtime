import { TransitMap } from '@railtime/renderer/transitMap.service';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { onBeforeUnmount, onMounted, watch } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { TransitMapMount } from '~/features/explorer/map/transitMap.composable.types';

/**
 * The map, and the only code that touches it. It is made on mount with the store's props and
 * listeners that write what it says into the store; each change of the props is given to it; it is
 * taken down on unmount. Every other part reads the store, and moves through time with the store's
 * actions. Client only: call it inside `<ClientOnly>`.
 *
 * @param mount - Where the map and the minimap go.
 */
export const useTransitMap = (mount: TransitMapMount): void => {
  const store = useExplorerStore();
  let map: TransitMap | null = null;

  onMounted(() => {
    const facts = store.facts;
    if (!facts) return;
    map = new TransitMap({
      container: mount.container.value!,
      minimapContainer: mount.minimapContainer.value ?? undefined,
      facts,
      props: store.mapProps,
      ...(store.view ? { view: store.view } : {}),
      // The page shows the credits itself, in a corner of the map.
      attributionControl: false,
      workerUrl,
      on: {
        time: time => store.timeChanged(time),
        step: step => (store.step = step),
        overlay: result => (store.overlayResult = result),
        view: view => (store.view = view),
        stationClick: id => (id ? store.pickStation(id) : store.closeStation()),
        // The station open left the map on another date: its view closes.
        selectionGone: () => store.closeStation(),
        end: () => store.playbackEnded(),
      },
    });
    store.attach(map);
  });

  watch(
    () => store.mapProps,
    props => map?.update(props),
  );

  onBeforeUnmount(() => {
    store.detach();
    map?.destroy();
    map = null;
  });
};
