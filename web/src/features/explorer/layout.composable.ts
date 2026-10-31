import { useCookie } from '#imports';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ShallowRef } from 'vue';

import { PANEL_WIDTH, PHONE_QUERY } from '~/features/explorer/explorer.constants';
import type { SheetSnap, TimeMode } from '~/features/explorer/explorer.types';
import type { ExplorerLayout } from '~/features/explorer/layout.composable.types';
import { draggedPanelWidth, mapPaddingFor } from '~/features/explorer/layout.utils';

/**
 * The explorer's layout: whether it is the phone's, the panel beside the map (open, its width, its
 * edge dragged), the phone's sheet, and map only. Client only, as the map is.
 *
 * @param root - The explorer's element, which map only takes full screen.
 * @returns The layout's state and what changes it.
 */
export const useExplorerLayout = (root: Readonly<ShallowRef<HTMLElement | null>>): ExplorerLayout => {
  const phoneQuery = window.matchMedia(PHONE_QUERY);
  const phone = ref(phoneQuery.matches);
  const onPhoneChange = (event: MediaQueryListEvent) => (phone.value = event.matches);
  const sheet = ref<SheetSnap>('peek');

  const panelOpen = useCookie<boolean>('railtime-panel-open', { default: () => true });
  const panelWidth = useCookie<number>('railtime-panel-width', { default: () => PANEL_WIDTH.initial });
  const minimapOn = useCookie<boolean>('railtime-minimap', { default: () => true });

  const mapOnly = ref(false);
  const panelCover = computed(() => (phone.value || mapOnly.value || !panelOpen.value ? 0 : panelWidth.value));

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

  const revealPanel = () => {
    if (!phone.value) panelOpen.value = true;
    else if (sheet.value === 'peek') sheet.value = 'half';
  };
  const togglePanel = () => {
    if (!phone.value) panelOpen.value = !panelOpen.value;
  };

  const toggleMapOnly = async () => {
    mapOnly.value = !mapOnly.value;
    // Not every browser has full screen (an iPhone's Safari): there the panels still hide.
    if (mapOnly.value) await root.value?.requestFullscreen?.().catch(() => undefined);
    else if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };
  // Leaving full screen (Esc, or the browser's own control) brings the panels back.
  const onFullscreenChange = () => {
    if (!document.fullscreenElement) mapOnly.value = false;
  };

  onMounted(() => {
    document.addEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.addEventListener('change', onPhoneChange);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    phoneQuery.removeEventListener('change', onPhoneChange);
  });

  return {
    phone,
    sheet,
    panelOpen,
    panelWidth,
    minimapOn,
    panelCover,
    resizing,
    startResize,
    revealPanel,
    togglePanel,
    mapOnly,
    toggleMapOnly,
    mapPadding: (mode: TimeMode) => mapPaddingFor(mode, phone.value, sheet.value),
  };
};
