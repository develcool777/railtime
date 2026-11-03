import { storeToRefs } from 'pinia';
import { syncRef, useEventListener, useFullscreen, useMediaQuery } from '@vueuse/core';
import { ref, watch } from 'vue';
import type { ShallowRef } from 'vue';

import { PHONE_QUERY, TAB_LABELS_QUERY } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { ExplorerLayout } from '~/features/explorer/layout.composable.types';
import { draggedPanelWidth } from '~/features/explorer/layout.utils';

/**
 * What the layout takes from the browser: whether it is the phone's, and wide enough for its tabs'
 * names, the panel's edge dragged, and
 * full screen kept with map only. The layout's state is the store's. Client only, as the map is.
 *
 * @param root - The explorer's element, which map only takes full screen.
 * @returns Whether the panel's edge is being dragged, and what starts a drag.
 */
export const useExplorerLayout = (root: Readonly<ShallowRef<HTMLElement | null>>): ExplorerLayout => {
  const store = useExplorerStore();
  const { phone, tabLabels, panelWidth, mapOnly } = storeToRefs(store);

  // The store holds what the browser says, for every part to read.
  syncRef(useMediaQuery(PHONE_QUERY), phone, { direction: 'ltr' });
  syncRef(useMediaQuery(TAB_LABELS_QUERY), tabLabels, { direction: 'ltr' });

  const resizing = ref(false);
  const startResize = (event: PointerEvent) => {
    const [startX, startWidth] = [event.clientX, panelWidth.value];
    resizing.value = true;
    const stops = [
      useEventListener(window, 'pointermove', (move: PointerEvent) => (panelWidth.value = draggedPanelWidth(startWidth, move.clientX - startX))),
      useEventListener(window, 'pointerup', () => {
        resizing.value = false;
        for (const stop of stops) stop();
      }),
    ];
  };

  // Map only takes the page full screen where the browser lets it: not every browser has it (an
  // iPhone's Safari), and none without a click (map only opened by a link), where the panels still hide.
  const { isFullscreen, enter, exit } = useFullscreen(root);
  watch(mapOnly, shown => (shown ? enter() : exit()).catch(() => undefined));
  // Leaving full screen (Esc, or the browser's own control) brings the panels back.
  watch(isFullscreen, full => {
    if (!full) store.setMapOnly(false);
  });

  return { resizing, startResize };
};
