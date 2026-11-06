import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { STORE_IDS } from '~/constants/store.constants';
import { PANEL_WIDTH } from '~/features/explorer/explorer.constants';
import type { ExplorerScreen, SheetSnap } from '~/features/explorer/explorer.types';
import { sheetHeightOf } from '~/features/explorer/layout.utils';

/**
 * How the page fits this screen: a phone's or not, the panel's width as dragged, the phone's sheet. None
 * of it goes in a link, which another screen would open. It reads no other store.
 */
export const useLayoutStore = defineStore(STORE_IDS.EXPLORER_LAYOUT, () => {
  // ---- State
  const phone = ref(false);
  /** A phone wide enough for its tabs' names. */
  const tabLabels = ref(false);
  /** Dragged for this screen, so kept for the visit only: in a link it would not fit another screen. */
  const panelWidth = ref(PANEL_WIDTH.initial);
  /** The panel's edge is being dragged. */
  const resizing = ref(false);
  const sheet = ref<SheetSnap>('peek');

  // ---- Getters
  /** How much of the map's foot the phone's sheet covers; `null` beside the map. */
  const sheetHeight = computed(() => (phone.value ? sheetHeightOf(sheet.value, tabLabels.value) : null));

  // ---- Actions
  /** A page opens: the sheet back down; the screen and the width dragged stay. */
  const OPEN = () => {
    sheet.value = 'peek';
  };
  /**
   * What the screen is, as the browser says.
   *
   * @param screen - A phone's or not, and wide enough for its tabs' names.
   */
  const SET_SCREEN = (screen: ExplorerScreen) => {
    phone.value = screen.phone;
    tabLabels.value = screen.tabLabels;
  };
  /**
   * Starts or ends dragging the panel's edge.
   *
   * @param dragging - Being dragged.
   */
  const SET_RESIZING = (dragging: boolean) => {
    resizing.value = dragging;
  };
  /**
   * The panel's width, dragged.
   *
   * @param width - Pixels.
   */
  const SET_PANEL_WIDTH = (width: number) => {
    panelWidth.value = width;
  };
  /**
   * Where the phone's sheet rests.
   *
   * @param snap - Its height, by name.
   */
  const SET_SHEET = (snap: SheetSnap) => {
    sheet.value = snap;
  };
  /** Brings the phone's sheet into sight: up to half, from its tabs alone. */
  const RAISE_SHEET = () => {
    if (sheet.value === 'peek') sheet.value = 'half';
  };

  return {
    // State
    phone,
    tabLabels,
    panelWidth,
    resizing,
    sheet,
    // Getters
    sheetHeight,
    // Actions
    OPEN,
    SET_SCREEN,
    SET_RESIZING,
    SET_PANEL_WIDTH,
    SET_SHEET,
    RAISE_SHEET,
  };
});
