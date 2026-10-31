import { storeToRefs } from 'pinia';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ShallowRef } from 'vue';

import { PHONE_QUERY } from '~/features/explorer/explorer.constants';
import { useExplorerStore } from '~/features/explorer/explorer.store';
import type { ExplorerLayout } from '~/features/explorer/layout.composable.types';
import { draggedPanelWidth } from '~/features/explorer/layout.utils';

/**
 * What the layout takes from the browser: whether it is the phone's, the panel's edge dragged, and
 * full screen kept with map only. The layout's state is the store's. Client only, as the map is.
 *
 * @param root - The explorer's element, which map only takes full screen.
 * @returns Whether the panel's edge is being dragged, and what starts a drag.
 */
export const useExplorerLayout = (root: Readonly<ShallowRef<HTMLElement | null>>): ExplorerLayout => {
  const store = useExplorerStore();
  const { phone, panelWidth, mapOnly } = storeToRefs(store);

  const phoneQuery = window.matchMedia(PHONE_QUERY);
  phone.value = phoneQuery.matches;
  const onPhoneChange = (event: MediaQueryListEvent) => (phone.value = event.matches);

  const resizing = ref(false);
  const startResize = (event: PointerEvent) => {
    const startX = event.clientX;
    const startWidth = panelWidth.value;
    resizing.value = true;
    const onMove = (move: PointerEvent) => (panelWidth.value = draggedPanelWidth(startWidth, move.clientX - startX));
    const onUp = () => {
      resizing.value = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Map only takes the page full screen where the browser lets it: not every browser has it (an
  // iPhone's Safari), and none without a click (map only opened by a link), where the panels still hide.
  watch(mapOnly, async shown => {
    if (shown && !document.fullscreenElement) await root.value?.requestFullscreen?.().catch(() => undefined);
    else if (!shown && document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  });
  // Leaving full screen (Esc, or the browser's own control) brings the panels back.
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) store.setMapOnly(false);
  };

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.addEventListener('change', onPhoneChange);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.removeEventListener('change', onPhoneChange);
  });

  return { resizing, startResize };
};
