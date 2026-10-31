import type { TransitMap } from '@railtime/renderer/transitMap.service';
import { storeToRefs } from 'pinia';
import { watch } from 'vue';
import type { ShallowRef } from 'vue';

import { useExplorerStore } from '~/features/explorer/explorer.store';

/**
 * How the map is seen, as the store has it: flat or in 3D, its stations named or not. The map is told
 * once mounted, and on each change.
 *
 * @param map - The map, once mounted.
 */
export const useMapLook = (map: ShallowRef<TransitMap | null>): void => {
  const { viewMode, stationNames } = storeToRefs(useExplorerStore());
  watch([map, viewMode], ([transitMap, mode]) => transitMap?.setViewMode(mode));
  watch([map, stationNames], ([transitMap, shown]) => transitMap?.setStationLabels(shown));
};
