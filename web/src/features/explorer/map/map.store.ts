import type { TransitMap } from '@railtime/renderer/transitMap.service';
import type { Credit, MapView } from '@railtime/renderer/transitMap.types';
import { defineStore } from 'pinia';
import { markRaw, shallowRef } from 'vue';

import { STORE_IDS } from '~/constants/store.constants';

/**
 * The map, once mounted (`useTransitMap` makes it and hands it here): what it owes credit to, where it
 * looks, and the commands that move its camera. The time store sends it the commands that move it
 * through time; nothing else gives it any. It reads no other store.
 */
export const useMapStore = defineStore(STORE_IDS.EXPLORER_MAP, () => {
  // ---- State
  /** The map, while mounted. */
  const map = shallowRef<TransitMap | null>(null);
  /** What the map owes credit to, once mounted. */
  const credits = shallowRef<Credit[]>([]);
  /** Where the map looks: as it opened, then as it tells it. */
  const view = shallowRef<MapView | null>(null);

  // ---- Actions
  /**
   * Opens on where the address says the map looks, if it says.
   *
   * @param opening - Where it looks, or `null` to fit the network.
   */
  const OPEN = (opening: MapView | null) => (view.value = opening);
  /**
   * Takes the map, once mounted.
   *
   * @param mounted - The map.
   */
  const ATTACH = (mounted: TransitMap) => {
    map.value = markRaw(mounted);
    credits.value = mounted.credits;
  };
  /** Lets the map go, as it is taken down. */
  const DETACH = () => (map.value = null);
  /**
   * The map stopped moving: where it looks now.
   *
   * @param next - Where it looks.
   */
  const SET_VIEW = (next: MapView) => (view.value = next);
  /** Zooms in a step. */
  const ZOOM_IN = () => map.value?.zoomIn();
  /** Zooms out a step. */
  const ZOOM_OUT = () => map.value?.zoomOut();
  /** Frames the whole network. */
  const FIT_NETWORK = () => map.value?.fitNetwork();

  return {
    // State
    map,
    credits,
    view,
    // Actions
    OPEN,
    ATTACH,
    DETACH,
    SET_VIEW,
    ZOOM_IN,
    ZOOM_OUT,
    FIT_NETWORK,
  };
});
