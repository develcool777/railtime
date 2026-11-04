import { useColorMode } from '#imports';
import { useEventListener, useFullscreen, useMediaQuery } from '@vueuse/core';
import { watch } from 'vue';
import type { ShallowRef } from 'vue';

import { PHONE_QUERY, TAB_LABELS_QUERY } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { ExplorerLayout } from '~/features/explorer/layout.composable.types';
import { draggedPanelWidth } from '~/features/explorer/layout.utils';

/**
 * What the browser says, given to the explorer's store, and what the store asks of the browser: an
 * effect, and nothing else. The screen (a phone's, wide enough for its tabs' names) and dark or light
 * go in through `SET_SCREEN` and `SET_THEME`; map only takes the page full screen, and leaving full
 * screen leaves map only; a drag of the panel's edge sets its width. Client only, as the map is.
 *
 * @param root - The explorer's element, which map only takes full screen.
 * @returns What starts a drag of the panel's edge.
 */
export const useExplorerLayout = (root: Readonly<ShallowRef<HTMLElement | null>>): ExplorerLayout => {
  const store = useExplorerStore();
  const colorMode = useColorMode();

  const phone = useMediaQuery(PHONE_QUERY);
  const tabLabels = useMediaQuery(TAB_LABELS_QUERY);
  watch([phone, tabLabels], ([isPhone, wide]) => store.SET_SCREEN({ phone: isPhone, tabLabels: wide }), { immediate: true });
  watch(
    () => colorMode.value,
    mode => store.SET_THEME(mode === 'light' ? 'light' : 'dark'),
    { immediate: true },
  );

  /**
   * Drags the panel's edge, from where it was pressed, until it is let go.
   *
   * @param event - The press on the edge.
   */
  const startResize = (event: PointerEvent) => {
    const [startX, startWidth] = [event.clientX, store.panelWidth];
    store.SET_RESIZING(true);
    const stops = [
      useEventListener(window, 'pointermove', (move: PointerEvent) => store.SET_PANEL_WIDTH(draggedPanelWidth(startWidth, move.clientX - startX))),
      useEventListener(window, 'pointerup', () => {
        store.SET_RESIZING(false);
        for (const stop of stops) stop();
      }),
    ];
  };

  // Map only takes the page full screen where the browser lets it: not every browser has it (an
  // iPhone's Safari), and none without a click (map only opened by a link), where the panels still hide.
  const { isFullscreen, enter, exit } = useFullscreen(root);
  watch(
    () => store.mapOnly,
    shown => (shown ? enter() : exit()).catch(() => undefined),
  );
  // Leaving full screen (Esc, or the browser's own control) brings the panels back.
  watch(isFullscreen, full => {
    if (!full) store.SET_MAP_ONLY(false);
  });

  return { startResize };
};
