import type { TransitMap } from '@railtime/renderer/transitMap.service';
import { storeToRefs } from 'pinia';
import { watch } from 'vue';
import type { ShallowRef } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';

/**
 * What the map draws over the network, as the store asks: the map works it out again on each date and
 * theme, and says what it came to (the binding's `overlay`).
 *
 * @param map - The map, once mounted.
 */
export const useMapOverlay = (map: ShallowRef<TransitMap | null>): void => {
  const { overlayRequest } = storeToRefs(useExplorerStore());
  watch([map, overlayRequest], ([transitMap, request]) => transitMap?.showOverlay(request), { deep: true });
};
